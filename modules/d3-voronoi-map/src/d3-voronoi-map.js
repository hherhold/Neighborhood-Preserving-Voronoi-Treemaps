import {
    polygonArea as d3PolygonArea,
    polygonCentroid as d3PolygonCentroid,
    polygonContains as d3PolygonContains
} from 'd3-polygon';
import {median as d3Median} from 'd3';
import {timer as d3Timer} from 'd3-timer';
import {dispatch as d3Dispatch} from 'd3-dispatch';
import {weightedVoronoi as d3WeightedVoronoi} from 'd3-weighted-voronoi';
import {FlickeringMitigation} from './flickering-mitigation';
import randomInitialPosition from './initial-position-policies/random';
import pieInitialPosition from './initial-position-policies/pie';
import halfAverageAreaInitialWeight from './initial-weight-policies/half-average-area';
import d3VoronoiMapError from './d3-voronoi-map-error';
import {intersect} from "../../../src/helpers/helpers";
import {Line, Point, Polygon, Segment, Vector} from "@flatten-js/core";

export function voronoiMapSimulation(data) {
    //begin: constants
    var DEFAULT_CONVERGENCE_RATIO = 0.01;
    var DEFAULT_MAX_ITERATION_COUNT = 20;
    var DEFAULT_MIN_WEIGHT_RATIO = 0.01;
    var DEFAULT_PRNG = Math.random;
    var DEFAULT_INITIAL_POSITION = randomInitialPosition();
    var DEFAULT_INITIAL_WEIGHT = halfAverageAreaInitialWeight();
    var RANDOM_INITIAL_POSITION = randomInitialPosition();
    var PIE_INITIAL_POSITION = pieInitialPosition();
    var DEFAULT_SIMILARITY = false;
    var epsilon = 1e-10;
    //end: constants

    /////// Inputs ///////
    var weight = function (d) {
        return d.weight;
    }; // accessor to the weight
    var convergenceRatio = DEFAULT_CONVERGENCE_RATIO; // targeted allowed error ratio; default 0.01 stops computation when cell areas error <= 1% clipping polygon's area
    var maxIterationCount = DEFAULT_MAX_ITERATION_COUNT; // maximum allowed iteration; stops computation even if convergence is not reached; use a large amount for a sole converge-based computation stop
    var minWeightRatio = DEFAULT_MIN_WEIGHT_RATIO; // used to compute the minimum allowed weight; default 0.01 means 1% of max weight; handle near-zero weights, and leaves enought space for cell hovering
    var prng = DEFAULT_PRNG; // pseudorandom number generator
    var initialPosition = DEFAULT_INITIAL_POSITION; // accessor to the initial position; defaults to a random position inside the clipping polygon
    var initialWeight = DEFAULT_INITIAL_WEIGHT; // accessor to the initial weight; defaults to the average area of the clipping polygon
    var similarity = DEFAULT_SIMILARITY;
    var useDefault = false;// maximum allowed iteration; stops computation even if convergence is not reached; use a large amount for a sole converge-based computation stop
    var attractionArray = [];
    var attractionDictionary = {};
    var constraintsFullfilled = {};
    var similarityStore = {};
    var polygonsWholeRank = {};
    var intersectionsWholeRank = {}
    var currentInitializationStrategy = "random"
    var lastMovementDict = {};

    //begin: internals
    var weightedVoronoi = d3WeightedVoronoi(),
        flickeringMitigation = new FlickeringMitigation(),
        shouldInitialize = true, // should initialize due to changes via APIs
        siteCount, // number of sites
        totalArea, // area of the clipping polygon
        areaErrorTreshold, // targeted allowed area error (= totalArea * convergenceRatio); below this treshold, map is considered obtained and computation stops
        iterationCount, // current iteration
        polygons, // current computed polygons
        areaError, // current area error
        converged, // true if (areaError < areaErrorTreshold)
        ended,
        clippingPolygon; // stores if computation is ended, either if computation has converged or if it has reached the maximum allowed iteration
    //end: internals
    //being: internals/simulation
    var simulation,
        stepper = d3Timer(step),
        event = d3Dispatch('tick', 'end');
    //end: internals/simulation

    //begin: algorithm conf.
    const HANDLE_OVERWEIGHTED_VARIANT = 0; // this option still exists 'cause for further experiments
    const HANLDE_OVERWEIGHTED_MAX_ITERATION_COUNT = 500; // max number of tries to handle overweigthed sites
    var handleOverweighted;
    //end: algorithm conf.

    //begin: utils
    function sqr(d) {
        return Math.pow(d, 2);
    }

    function squaredDistance(s0, s1) {
        return sqr(s1.x - s0.x) + sqr(s1.y - s0.y);
    }


    //end: utils

    ///////////////////////
    ///////// API /////////
    ///////////////////////

    simulation = {
        tick: tick,
        step: step,

        restart: function () {
            stepper.restart(step);
            return simulation;
        },

        setStateTo: function (poly, iter, conv) {
            iterationCount = iter;
            convergenceRatio = conv;
            polygons = poly;
            ended = false;
            return simulation;
        },

        stop: function () {
            stepper.stop();
            return simulation;
        },

        weight: function (_) {
            if (!arguments.length) {
                return weight;
            }

            weight = _;
            shouldInitialize = true;
            return simulation;
        },

        convergenceRatio: function (_) {
            if (!arguments.length) {
                return convergenceRatio;
            }

            convergenceRatio = _;
            shouldInitialize = true;
            return simulation;
        },

        maxIterationCount: function (_) {
            if (!arguments.length) {
                return maxIterationCount;
            }

            maxIterationCount = _;
            return simulation;
        },

        minWeightRatio: function (_) {
            if (!arguments.length) {
                return minWeightRatio;
            }

            minWeightRatio = _;
            shouldInitialize = true;
            return simulation;
        },

        clip: function (_) {
            if (!arguments.length) {
                return weightedVoronoi.clip();
            }
            clippingPolygon = _;
            weightedVoronoi.clip(_);
            shouldInitialize = true;
            return simulation;
        },

        extent: function (_) {
            if (!arguments.length) {
                return weightedVoronoi.extent();
            }

            weightedVoronoi.extent(_);
            shouldInitialize = true;
            return simulation;
        },

        size: function (_) {
            if (!arguments.length) {
                return weightedVoronoi.size();
            }

            weightedVoronoi.size(_);
            shouldInitialize = true;
            return simulation;
        },

        prng: function (_) {
            if (!arguments.length) {
                return prng;
            }

            prng = _;
            shouldInitialize = true;
            return simulation;
        },

        currentInitializationStrategy: function (_) {
            if (!arguments.length) {
                return currentInitializationStrategy;
            }

            currentInitializationStrategy = _;
            shouldInitialize = true;
            return simulation;
        },

        initialPosition: function (_) {
            // if (currentInitializationStrategy === 'random') {
            //     initialPosition = RANDOM_INITIAL_POSITION
            // } else
            if (currentInitializationStrategy === 'pie') {
                initialPosition = PIE_INITIAL_POSITION
            } else if (currentInitializationStrategy === 'projectionMapping'
                || currentInitializationStrategy === 'force' || currentInitializationStrategy === 'swapping' || currentInitializationStrategy === 'random') {
                initialPosition = _;
            }
            if (!arguments.length) {
                return initialPosition;
            }

            shouldInitialize = true;
            return simulation;

        },

        initialWeight: function (_) {
            if (!arguments.length) {
                return initialWeight;
            }

            initialWeight = _;
            shouldInitialize = true;
            return simulation;
        },

        state: function () {
            if (shouldInitialize) {
                initializeSimulation();
            }
            return {
                ended: ended,
                iterationCount: iterationCount,
                convergenceRatio: areaError / totalArea,
                polygons: polygons,
            };
        },

        on: function (name, _) {
            if (arguments.length === 1) {
                return event.on(name);
            }

            event.on(name, _);
            return simulation;
        }, similarity: function (_) {
            if (!arguments.length) {
                return similarity;
            }

            similarity = _;
            return simulation;
        },
        attractionArray: function (_) {
            if (!arguments.length) {
                return attractionArray;
            }

            attractionArray = _;
            return simulation;
        },
        attractionDictionary: function (_) {
            if (!arguments.length) {
                return attractionDictionary;
            }

            attractionDictionary = _;
            return simulation;
        },
        constraintsFullfilled: function (_) {
            if (!arguments.length) {
                return constraintsFullfilled;
            }

            constraintsFullfilled = _;
            return simulation;
        },
        similarityStore: function (_) {
            if (!arguments.length) {
                return similarityStore;
            }

            similarityStore = _;
            return simulation;
        },
        polygonsWholeRank: function (_) {
            if (!arguments.length) {
                return polygonsWholeRank;
            }

            polygonsWholeRank = _;
            return simulation;
        },
        intersectionsWholeRank: function (_) {
            if (!arguments.length) {
                return intersectionsWholeRank;
            }

            intersectionsWholeRank = _;
            return simulation;
        },
        useDefault: function (_) {
            if (!arguments.length) {
                return useDefault;
            }

            useDefault = _;
            return simulation;
        },
        lastMovementDict: function (_) {
            if (!arguments.length) {
                return lastMovementDict;
            }

            lastMovementDict = _;
            return simulation;
        },
    };

    ///////////////////////
    /////// Private ///////
    ///////////////////////

    //begin: simulation's main loop
    function step() {
        tick();
        event.call('tick', simulation);
        if (ended) {
            stepper.stop();
            event.call('end', simulation);
        }
    }

    //end: simulation's main loop

    //begin: algorithm used at each iteration
    function tick() {
        if (!ended) {
            if (shouldInitialize) {
                initializeSimulation();
            }
            try {
                polygons = adapt(polygons, flickeringMitigation.ratio());
            } catch (error) {
                console.log("Cannot compute Convex Hull")
                // throw new d3VoronoiMapError('Cannot compute Convex Hull');
            }
            iterationCount++;
            areaError = computeAreaError(polygons);
            flickeringMitigation.add(areaError);
            converged = areaError < areaErrorTreshold - 0.1;
            ended = (iterationCount > maxIterationCount);
            if (ended) {
                event.call('end', simulation);
            }
        } else {
            event.call('end', simulation);
        }
    }

    //end: algorithm used at each iteration

    function initializeSimulation() {
        //begin: handle algorithm's variants
        setHandleOverweighted();
        //end: handle algorithm's variants
        if (data === null) {
            console.log("No data given")
        }
        siteCount = data.length;
        totalArea = Math.abs(d3PolygonArea(weightedVoronoi.clip()));
        areaErrorTreshold = convergenceRatio * totalArea;
        flickeringMitigation.clear().totalArea(totalArea);

        iterationCount = 0;
        converged = false;
        polygons = initialize(data, simulation);
        ended = false;
        shouldInitialize = false;
    }

    function initialize(data, simulation) {
        var maxWeight = data.reduce(function (max, d) {
                return Math.max(max, weight(d));
            }, -Infinity),
            minAllowedWeight = maxWeight * minWeightRatio;
        var weights, mapPoints;

        if (isNaN(maxWeight)) {
            console.log("weight is Nan")
        }
        //begin: extract weights
        weights = data.map(function (d, i, arr) {
            return {
                index: i,
                weight: Math.max(weight(d), minAllowedWeight),
                initialPosition: initialPosition(d, i, arr, simulation),
                initialWeight: initialWeight(d, i, arr, simulation),
                originalData: d,
            };
        });
        //end: extract weights

        // create map-related points
        // (with targetedArea, initial position and initialWeight)
        mapPoints = createMapPoints(weights, simulation);
        handleOverweighted(mapPoints);
        let polygons = []
        try {
            polygons = weightedVoronoi(mapPoints);
        } catch (error) {
            console.log("Cannot compute Convex Hull during initialization")
            throw new Error('Cannot compute Convex Hull');
        }
        return polygons;
        // return weightedVoronoi(mapPoints);
    }

    function createMapPoints(basePoints, simulation) {
        var totalWeight = basePoints.reduce(function (acc, bp) {
            return (acc += bp.weight);
        }, 0);
        if (totalWeight === 0) {
            console.log("nan")
        }
        var initialPosition;

        return basePoints.map(function (bp, i, bps) {
            initialPosition = bp.initialPosition;

            if (bp.weight === undefined) {
                console.log("error, weioght undefined")
            }
            if (!d3PolygonContains(weightedVoronoi.clip(), initialPosition)) {
                initialPosition = initialPosition(bp, i, bps, simulation);
            }
            if (isNaN((totalArea * bp.weight) / totalWeight)) {
                console.log("nan")
            }
            return {
                index: bp.index,
                targetedArea: (totalArea * bp.weight) / totalWeight,
                data: bp,
                x: initialPosition[0],
                y: initialPosition[1],
                weight: bp.initialWeight, // ArlindNocaj/Voronoi-Treemap-Library uses an epsilonesque initial weight; using heavier initial weights allows faster weight adjustements, hence faster stabilization
            };
        });
    }

    function adapt(polygons, flickeringMitigationRatio) {
        var adaptedMapPoints;
        if (useDefault) {
            adaptPositions(polygons, flickeringMitigationRatio);
            adaptedMapPoints = polygons.map(function (p) {
                return p.site.originalObject;
            });
            polygons = weightedVoronoi(adaptedMapPoints);
            if (polygons.length < siteCount) {
                throw new d3VoronoiMapError('at least 1 site has no area, which is not supposed to arise');
            }

            adaptWeights(polygons, flickeringMitigationRatio);
            adaptedMapPoints = polygons.map(function (p) {
                return p.site.originalObject;
            });
            polygons = weightedVoronoi(adaptedMapPoints);
            if (polygons.length < siteCount) {
                throw new d3VoronoiMapError('at least 1 site has no area, which is not supposed to arise');
            }
            return polygons;
        } else {
            try {
                adaptPositionsD(polygons, flickeringMitigationRatio, attractionArray);
            } catch (error) {
                console.log("handleOverweighted")
                throw new d3VoronoiMapError('handleOverweighted');
            }
            // adaptPositions(polygons, flickeringMitigationRatio, attractionArray);
            adaptedMapPoints = polygons.map(function (p) {
                if (p.site.directNeighborsAll && p.site.directNeighborsAllObjects && p.site.intersectedges) {
                    p.site.originalObject.directNeighborsAll = p.site.directNeighborsAll
                    p.site.originalObject.directNeighborsAllObjects = p.site.directNeighborsAllObjects
                    p.site.originalObject.intersectedges = p.site.intersectedges
                    p.site.originalObject.vectorSourceTarget = p.site.vectorSourceTarget
                    p.site.originalObject.vectorAlongParent = p.site.vectorAlongParent
                }
                p.site.originalObject.vectorSourceTarget = p.site.vectorSourceTarget
                if (maxIterationCount < 30) {
                    p.site.originalObject.weight = p.site.originalObject.data.initialWeight
                } else if (iterationCount === maxIterationCount - 50) {
                    p.site.originalObject.weight = p.site.originalObject.data.initialWeight
                } else if (maxIterationCount >= 20 && iterationCount < maxIterationCount - 45) {
                    p.site.originalObject.weight = p.site.originalObject.data.initialWeight
                } else if (iterationCount >= maxIterationCount - 45 && p.site.originalObject.weight < p.site.previousWeight) {
                    p.site.originalObject.weight = p.site.previousWeight
                }
                return p.site.originalObject;
            });
            if (adaptedMapPoints.some(d => isNaN(d.weight))) {
                console.log("weight became NaN!")
            }
            try {
                polygons = weightedVoronoi(adaptedMapPoints);
                for (let p of polygons) {
                    let isInsidePoly = d3PolygonContains(weightedVoronoi.clip(), [p.site.x, p.site.y])
                    if (!isInsidePoly) {
                        console.log("Map Point still not in polygon, undo")
                    }
                }
                polygons.map(function (p) {
                    if (p.site.originalObject.directNeighborsAll) {
                        p.site.directNeighborsAll = p.site.originalObject.directNeighborsAll
                        p.site.directNeighborsAllObjects = p.site.originalObject.directNeighborsAllObjects
                        p.site.intersectedges = p.site.originalObject.intersectedges
                        p.site.intersectedgesObjects = p.site.originalObject.intersectedgesObjects
                        p.site.previousWeight = p.site.originalObject.weight
                        p.site.vectorSourceTarget = p.site.originalObject.vectorSourceTarget
                        p.site.vectorAlongParent = p.site.originalObject.vectorAlongParent
                    } else {
                        p.site.previousWeight = p.site.originalObject.data.initialWeight
                    }
                })
                adaptWeights(polygons, flickeringMitigationRatio);
                polygons.map(function (p) {
                    if (p.site.originalObject.directNeighborsAll) {
                        p.site.directNeighborsAll = p.site.originalObject.directNeighborsAll
                        p.site.directNeighborsAllObjects = p.site.originalObject.directNeighborsAllObjects
                        p.site.intersectedges = p.site.originalObject.intersectedges
                        p.site.intersectedgesObjects = p.site.originalObject.intersectedgesObjects
                        p.site.previousWeight = p.site.originalObject.weight
                        p.site.vectorSourceTarget = p.site.originalObject.vectorSourceTarget
                        p.site.vectorAlongParent = p.site.originalObject.vectorAlongParent
                    } else {
                        p.site.previousWeight = p.site.originalObject.data.initialWeight
                    }
                })
                adaptedMapPoints = polygons.map(function (p) {
                    return p.site.originalObject;
                });

                polygons = weightedVoronoi(adaptedMapPoints);
                polygons.map(function (p) {
                    if (p.site.originalObject.directNeighborsAll) {
                        p.site.directNeighborsAll = p.site.originalObject.directNeighborsAll
                        p.site.directNeighborsAllObjects = p.site.originalObject.directNeighborsAllObjects
                        p.site.intersectedges = p.site.originalObject.intersectedges
                        p.site.intersectedgesObjects = p.site.originalObject.intersectedgesObjects
                        p.site.previousWeight = p.site.originalObject.weight
                        p.site.vectorSourceTarget = p.site.originalObject.vectorSourceTarget
                        p.site.vectorAlongParent = p.site.originalObject.vectorAlongParent
                    } else {
                        p.site.previousWeight = p.site.originalObject.data.initialWeight
                    }
                })
                //THis overwrites the old data, so now we have manually keep it
                // adaptPositionsD(polygons, flickeringMitigationRatio, attractionArray);
            } catch (error) {
                console.log("Cannot compute Convex Hull")
                throw new d3VoronoiMapError('Cannot compute Convex Hull');
            }
            if (polygons.length < siteCount) {
                console.log('at least 1 site has no area, which is not supposed to arise')
                // throw new d3VoronoiMapError('at least 1 site has no area, which is not supposed to arise');
            }
            // adaptWeights(polygons, flickeringMitigationRatio);
            //Only do weighted optimization after the convergence hast reached about half
            // if(attractionDictionary.length === 0 ||  iterationCount > 20){
            if (adaptedMapPoints.some(d => isNaN(d.weight))) {
                console.log("weight became NaN!")
            }
            // adaptWeights(polygons, flickeringMitigationRatio);
            if (adaptedMapPoints.some(d => isNaN(d.weight))) {
                console.log("weight became NaN!")
            }
            // adaptedMapPoints = polygons.map(function (p) {
            //     return p.site.originalObject;
            // });
            // polygons = weightedVoronoi(adaptedMapPoints);
            if (adaptedMapPoints.some(d => isNaN(d.weight))) {
                console.log("weight became NaN!")
            }
            // }

            if (polygons.length < siteCount) {
                throw new d3VoronoiMapError('at least 1 site has no area, which is not supposed to arise');
            }

            return polygons;
        }

    }

    function adaptPositions(polygons, flickeringMitigationRatio) {
        var newMapPoints = [],
            flickeringInfluence = 0.5;
        var flickeringMitigation, d, polygon, mapPoint, centroid, dx, dy;

        flickeringMitigation = flickeringInfluence * flickeringMitigationRatio;
        d = 1 - flickeringMitigation; // in [0.5, 1]

        const uniform =
            Math.abs(
                d3PolygonArea(clippingPolygon)
            ) / data.length;

        for (let i = 0; i < polygons.length; i++) {
            const c = polygons[i];
            c.area = Math.abs(d3PolygonArea(c));
        }

        const minA = polygons.length === data.length;

        const A = d3Median(polygons, d => d.site.z);

        // for (let i = 0; i < points.length; i++) points[i][2] += 1000;

        for (var i = 0; i < siteCount; i++) {
            const c = polygons[i],
                p = c.site;

            // p.cell = c;
            // p.z = (p.z - 1000 - A) * 0.5;
            //
            // p.stress = Math.log(c.area / uniform);
            //
            // p.z -= 400 * p.stress;

            // advection?

            const [x, y] = d3PolygonCentroid([...c]);
            // if (isFinite(x) && isFinite(y)) {
            //     p.centroid = [x, y];
            //     const dx = x - p[0],
            //         dy = y - p[1];
            //     p.data.x += dx * 0.6;
            //     p[1] += dy * 0.6;
            //     //if (minA === 0) p[2] = 0;
            //     // $0.value = { t, points, centroid: [x, y] };
            // } else {
            //     // $0.value = p;
            // }

            polygon = polygons[i];
            mapPoint = polygon.site.originalObject;
            if (mapPoint.isFixed) {
                // mapPoint.x = polygon.site.x
                // mapPoint.y = polygon.site.y
                // mapPoint.isFixed =false;
                // return;
            } else {
                centroid = d3PolygonCentroid(polygon);

                dx = centroid[0] - mapPoint.x;
                dy = centroid[1] - mapPoint.y;

                //begin: handle excessive change;
                // dx *= d;
                // dy *= d;
                //end: handle excessive change;
                if (isFinite(x) && isFinite(y)) {
                    mapPoint.x += dx * 0.6;
                    mapPoint.y += dy * 0.6;
                } else {
                    console.log("error")
                }
            }


            newMapPoints.push(mapPoint);

            //Adapt weights according to arlind algo2 line 5
            let distanceBorder = 10000
            for (let j = 0; j < siteCount; j++) {
                let pj = polygons[j];
                let sqrD = squaredDistance(mapPoint, pj.site);
                if (sqrD < distanceBorder) {
                    distanceBorder = sqrD
                }
            }
            let wsStar = (Math.min(sqr(mapPoint.weight), distanceBorder)) ^ 2
            mapPoint.weight = wsStar
        }
    }

    const calculateMidPoint = function (point1, point2) {
        return [((point1[0] + point2[0]) / 2), ((point1[1] + point2[1]) / 2)];
    };

    const euclideanDist = (a, b) => {
        let _a = a;
        let _b = b;

        if (a.hasOwnProperty("x") &&
            a.hasOwnProperty("y")) {
            _a = [a.x, a.y];
        }
        if (b.hasOwnProperty("x") &&
            b.hasOwnProperty("y")) {
            _b = [b.x, b.y];
        }
        return Math.hypot(_b[0] - _a[0], _b[1] - _a[1]);
    }

    function calculateEdges(polygons) {
        let listEdges = []
        for (var i = 0; i < siteCount; i++) {
            let currPolygon = polygons[i]
            let currChild = currPolygon.site.originalObject.data.originalData;
            for (let k = 0; k < currPolygon.site.propertiesNeighboursClipped.length; k++) {
                //Loop over all points of the polygon
                let currN = currPolygon.site.propertiesNeighboursClipped[k];
                let prevIdx = k > 0 ? k - 1 : currPolygon.length - 1;
                let prevN = currPolygon.site.propertiesNeighboursClipped[prevIdx];
                let left = currPolygon[k];
                let right = currPolygon[prevIdx];
                if (currN.id !== -1) { //is boundary vertex
                    if (left !== undefined && right !== undefined) {
                        if (!listEdges.some(d => d.source === currN.id && d.target === currChild.data.id)
                        ) {
                            listEdges.push(
                                {
                                    source: currChild.data.id,
                                    target: currN.id,
                                    line: calculateMidPoint(left, right),
                                    dist: euclideanDist(left, right)
                                }
                            );
                        }
                    }
                } else {
                    //the line is a border line
                    //Given the outer shape clippingPolygon, we can match left and right,
                    //Instead of setting -1, we set the position of the polygon
                    //if left === clippingPolygon[i]
                    // console.log(clippingPolygon)
                    // console.log('error')
                    //on depth 0 the similarity is always 0
                    listEdges.push(
                        {
                            source: currChild.data.id,
                            target: currN.id,
                            line: calculateMidPoint(left, right),
                            dist: euclideanDist(left, right)
                        }
                    );
                }
            }
        }
        return listEdges;
    }

    function adaptPositionsSimilarity(polygons, flickeringMitigationRatio, attrObj) {
        var newMapPoints = [],
            flickeringInfluence = 0.5;
        var flickeringMitigation, d, polygon, mapPoint, centroid;
        var dx = 0;
        var dy = 0;

        flickeringMitigation = flickeringInfluence * flickeringMitigationRatio;
        d = 1 - flickeringMitigation * 0.5; // in [0.5, 1]
        siteCount = polygons.length;

        for (var i = 0; i < siteCount; i++) {
            polygon = polygons[i];
            mapPoint = polygon.site.originalObject;
            centroid = d3PolygonCentroid(polygon);
            let currID = polygon.site.originalObject.data.originalData.data.id
            let sourceMatch = attrObj.findIndex(d => d.sourceID === currID)
            let targetMatch = attrObj.findIndex(d => d.targetID === currID)

            if (sourceMatch !== -1) {
                //dx and dy from attraction
                dx = attrObj[sourceMatch].vecSourceTarget[0]
                dy = attrObj[sourceMatch].vecSourceTarget[1]
                // dx = centroid[0] - mapPoint.x;
                // dy = centroid[1] - mapPoint.y;
                d = 20
                // targetPoint = [dx[0]*distance+polygon.site.x, dx[1]*eDistAtoB + polygon.site.y]
                //begin: handle excessive change;
                dx *= d;
                dy *= d;
                mapPoint.x += dx;
                mapPoint.y += dy;
            } else if (targetMatch !== -1) {
                dx = attrObj[targetMatch].vecTargetSource[0]
                dy = attrObj[targetMatch].vecTargetSource[1]
                d = 20

                dx *= d;
                dy *= d;
                mapPoint.x += dx;
                mapPoint.y += dy;
            }
            newMapPoints.push(mapPoint);
        }

        handleOverweighted(newMapPoints);
    }


    function moveTowardsAttraction(polygon, attractionArray, sourceMatch, mapPoint, centroid, targetPolygon, diff, invert, circular, targetPositionOuter, vectorAlongParent, euclidDist) { //avgCentroid
        //We have to recalculate the vectors here every time
        //THe amount it moves should depend on the distance it has to go


        //if they have the same parent, we use the new positions, otherwise we can use the one in the attractionarray.
        //or we update the attraction array after each step as well
        let betweenVec;
        let len;
        let betweenVecNormalize;
        let targetPosition;
        if (targetPolygon !== undefined && targetPolygon.site.originalObject.data.originalData.parent.data.id === polygon.site.originalObject.data.originalData.parent.data.id) {
            //same parent
            targetPosition = [targetPolygon.site.x, targetPolygon.site.y]
            betweenVec = [targetPosition[0] - mapPoint.x, targetPosition[1] - mapPoint.y];
            len = Math.sqrt((betweenVec[0] * betweenVec[0]) + (betweenVec[1] * betweenVec[1]));
            betweenVecNormalize = [betweenVec[0] / len, betweenVec[1] / len];
        } else {
            targetPosition = attractionArray[sourceMatch].targetPos
            betweenVec = [targetPosition[0] - mapPoint.x, targetPosition[1] - mapPoint.y];
            len = Math.sqrt((betweenVec[0] * betweenVec[0]) + (betweenVec[1] * betweenVec[1]));
            betweenVecNormalize = [betweenVec[0] / len, betweenVec[1] / len];
        }
        if (invert) {
            console.log("inverting direction")
            betweenVecNormalize = [-betweenVecNormalize[0], -betweenVecNormalize[1]]
        }

        if (targetPositionOuter) {
            targetPosition = targetPositionOuter
            betweenVec = [targetPosition[0] - mapPoint.x, targetPosition[1] - mapPoint.y];
            len = Math.sqrt((betweenVec[0] * betweenVec[0]) + (betweenVec[1] * betweenVec[1]));
            betweenVecNormalize = [betweenVec[0] / len, betweenVec[1] / len];
        }

        let mpCopy = [mapPoint.x, mapPoint.y]
        let movementSize = 5;
        let sameParent = targetPolygon.site.originalObject.data.originalData.parent.data.id === polygon.site.originalObject.data.originalData.parent.data.id
        if (!sameParent) {
            movementSize = 5
        }

        // let newVectorSourceTarget = flatten_source_point.translate(vectorSourceTarget.multiply(50))
        //polygon.site.vectorSourceTarget = new Segment(flatten_source_point, newVectorSourceTarget);
        let offsetX = diff * movementSize * (betweenVecNormalize[0])
        let newPosX = mapPoint.x + offsetX;//dx;
        // newPosX += diff*( 2* betweenVecNormalize[1])
        let offsetY = diff * movementSize * (betweenVecNormalize[1])
        let newPosY = mapPoint.y + offsetY;//dx;
        let tempPoint = new Point(newPosX, newPosY)
        if (targetPositionOuter) {//&& avgCentroid === undefined
            let tempPoint2 = new Point(mapPoint.x, mapPoint.y)
            let newVectorSourceTarget = tempPoint2.translate(vectorAlongParent.multiply(diff * movementSize))
            newPosX = newVectorSourceTarget.x
            newPosY = newVectorSourceTarget.y
        } else {

        }

        // if the distance to another cell is too small, we do not move
        let mindist = 10
        let mindistN = 999
        for(let poly of polygons){
            if(poly.site.id !== polygon.site.id){
                let tempDist = euclideanDist(poly.site, {x:newPosX, y:newPosY})
                if(tempDist < mindistN){
                    mindistN = tempDist
                }
            }
        }
        if (mindistN < mindist){
            // console.log("do not move!")
        }
        //Calculate if the distance to the centroid is too large, then we cannot move
        let polygonFlatten = new Polygon(polygon)
        let polygonFlattenParent = new Polygon(weightedVoronoi.clip())
        let dist = polygonFlatten.distanceTo(new Point(newPosX, newPosY))

        polygon.site.vectorSourceTarget = new Segment(new Point(mapPoint.x, mapPoint.y), tempPoint);

        let isInsidePoly = d3PolygonContains(weightedVoronoi.clip(), [newPosX, newPosY])
        mapPoint.previousPosition = {x: mapPoint.x, y: mapPoint.y}
        mapPoint.lastMovementVector = {x: offsetX, y: offsetY}
        let minDistPoints = 10
        if (mapPoint.data.originalData.depth > 2) {
            minDistPoints = 15;
            mindist = 15;
        }
        if (!isInsidePoly || (mindistN < mindist) || (!sameParent && (dist[0] < minDistPoints))) { //len > edgeLength
            // console.log("error, not inside polygon")
            polygon.site.x = mapPoint.x
            polygon.site.y = mapPoint.y
            let isInsidePolyInit = d3PolygonContains(weightedVoronoi.clip(), [mapPoint.x, mapPoint.y])
            if (!isInsidePolyInit) {
                console.log("error, not inside polygon, insert at centroid")
                polygon.site.x = weightedVoronoi.clip().centroid.x
                polygon.site.y = weightedVoronoi.clip().centroid.y
            }
            return false
        } else {
            mapPoint.x = newPosX
            mapPoint.y = newPosY
            polygon.site.x = mapPoint.x
            polygon.site.y = mapPoint.y
            if (Math.abs(polygon.site.x - mpCopy[0]) > 20) {
                console.log("error")
            }
            return true
        }
    }

    function moveTowardsFix(polygon, mapPoint, diff, centroid, attractionArray, sourceMatch) {
        let dx = centroid[0] - mapPoint.x;
        let dy = centroid[1] - mapPoint.y;
        let betweenVec = [attractionArray[sourceMatch].sourcePos[0] - attractionArray[sourceMatch].targetPos[0], attractionArray[sourceMatch].sourcePos[1] - attractionArray[sourceMatch].targetPos[1]];
        let len = Math.sqrt((betweenVec[0] * betweenVec[0]) + (betweenVec[1] * betweenVec[1]));
        let betweenVecNormalize = [betweenVec[0] / len, betweenVec[1] / len];



        //begin: handle excessive change;
        dx *= diff;
        dy *= diff;
        //end: handle excessive change;

        mapPoint.x += (5 * betweenVecNormalize[1])//dx;
        mapPoint.y += (5 * (-betweenVecNormalize[0]))//dy;
        polygon.site.x = mapPoint.x
        polygon.site.y = mapPoint.y

    }

    function moveTowards(polygon, mapPoint, diff, centroid) {
        let dx = centroid[0] - mapPoint.x;
        let dy = centroid[1] - mapPoint.y;

        //begin: handle excessive change;
        dx *= diff;
        dy *= diff;
        //end: handle excessive change;

        mapPoint.previousPosition = {x: mapPoint.x, y: mapPoint.y}
        mapPoint.lastMovementVector = {x: dx, y: dy}

        let isInsidePoly = d3PolygonContains(weightedVoronoi.clip(), [mapPoint.x + dx, mapPoint.y + dy])
        if (!isInsidePoly) { //len > edgeLength
            polygon.site.x = mapPoint.x
            polygon.site.y = mapPoint.y
            console.log("error, not inside polygon move Towards")
            let isInsidePolyInit = d3PolygonContains(weightedVoronoi.clip(), [mapPoint.x, mapPoint.y])
            if (!isInsidePolyInit) {
                console.log("error, not inside polygon move Towards Previous")
                polygon.site.x = weightedVoronoi.clip().centroid.x
                polygon.site.y = weightedVoronoi.clip().centroid.y
            }
            return true
        } else {
            mapPoint.x += dx;
            mapPoint.y += dy;
            // mapPoint.x = newPosX
            // mapPoint.y = newPosY
        }
        let tempPoint = new Point(mapPoint.x, mapPoint.y)
        polygon.site.vectorSourceTarget = new Segment(new Point(mapPoint.previousPosition.x, mapPoint.previousPosition.y), tempPoint);
        polygon.site.x = mapPoint.x
        polygon.site.y = mapPoint.y
    }

    function adaptPositionsD(polygons, flickeringMitigationRatio) {
        //Voronoi Setup
        let newMapPoints = [],
            flickeringInfluence = 0.5;
        let flickeringMitigation, diff, polygon, mapPoint, centroid, dx, dy;

        flickeringMitigation = flickeringInfluence * flickeringMitigationRatio;
        diff = 0.8 - flickeringMitigation; // in [0.5, 1]
        let sourceMatch = -1;

        //attractionDictionary holds all links for this rank
        //Extract first constraint for each node
        let filteredConstraints = Object.values(attractionDictionary).map(d => {
            d.sort((a, b) => b.sim - a.sim);
            return d[0]
        })
        //Get indices so that we can acess the array in any order
        let indicesSorted = Array.from(Array(siteCount).keys())
        //Only if we have any constraints, we have to add distances
        if (filteredConstraints.length > 0) {
            let sortedPolygonIndices = polygons.map(d => {
                let constraintsCurrent_inner = filteredConstraints.filter(e => e.sourceID === d.site.originalObject.data.originalData.data.id)
                //Get max Distance for the constraints
                if (constraintsCurrent_inner.length > 0) {
                    d.site.maxDist = constraintsCurrent_inner.sort((a, b) => a.distSourceTarget - b.distSourceTarget)[0].distSourceTarget;
                } else {
                    d.site.maxDist = 0;
                }
            });
            //Not enough, also have to order based on existing constraints or not.
            indicesSorted = Array.from(Array(polygons.length).keys())
                .sort((a, b) => polygons[a].site.maxDist > polygons[b].site.maxDist ? -1 : (polygons[b].site.maxDist > polygons[a].site.maxDist) | 0)

            // Prepare the library to detect all intersection
            let array_intersections = filteredConstraints.map(d => {
                let p1 = {
                    x: d.sourcePos[0],
                    y: d.sourcePos[1]
                }
                let p2 = {
                    x: d.targetPos[0],
                    y: d.targetPos[1]
                }
                let segment = {
                    from: p1,
                    to: p2
                }
                return segment
            })

        }

        //actually the largest distance should move first
        //Sim is in range from 0 to 100
        for (let i = 0; i < siteCount; i++) {
            let currIdx = indicesSorted[i]
            polygon = polygons[currIdx];
            mapPoint = polygon.site.originalObject;
            centroid = d3PolygonCentroid(polygon);
            let currID = polygon.site.originalObject.data.originalData.data.id
            // let currID = polygon.site.id;
            let neighborsExist = polygon.site.directNeighborsAll === undefined
            if (currentInitializationStrategy === 'swapping' && iterationCount && attractionDictionary.hasOwnProperty(currID) && polygon.site.hasOwnProperty('directNeighborsAll')) { //polygon.site.directNeighborsAll !== undefined
                let constraintsCurrent = attractionDictionary[currID]

                sourceMatch = attractionArray.findIndex(d => d.sourceID === currID)

                // Build object that tracks the status of all the constraints
                // Each object is a polygon has array filled with false
                if (!constraintsFullfilled.hasOwnProperty(currID) || (constraintsFullfilled.hasOwnProperty(currID) && constraintsCurrent.length !== constraintsFullfilled[currID].length)) {
                    constraintsFullfilled[currID] = new Array(constraintsCurrent.length).fill(false);
                }
                let constrainsFinished = constraintsFullfilled[currID].every(d => d.isFulfilled === true)

                //If the current node has constraints
                //sort contraints by similarity
                //For each constraint

                //split into two arrays, sort individually, then combine
                let constraintsDiffParent = constraintsCurrent.filter((d) => d.targetParent.id !== mapPoint.data.originalData.parent.data.id)
                let constraintsSameParent = constraintsCurrent.filter((d) => d.targetParent.id === mapPoint.data.originalData.parent.data.id)
                constraintsDiffParent.sort(function (a, b) {
                    if (constraintsCurrent.length > 0) {
                        return b.distSourceTarget - a.distSourceTarget
                    }
                })
                constraintsSameParent.sort(function (a, b) {
                    if (constraintsCurrent.length > 0) {
                        return b.distSourceTarget - a.distSourceTarget
                    }
                })
                constraintsCurrent = [...constraintsDiffParent, ...constraintsSameParent]
                let countMovements = 0;
                for (let j = 0; j < constraintsCurrent.length; j++) {
                    if (countMovements !== 0) {
                        break;
                    }

                    let arrayConstraintsFiltered = constraintsFullfilled[currID].every(d => d === true)
                    if (j > 0 && !arrayConstraintsFiltered) {
                        //if all constraints for this polygon have been fullfilled, we dont need to do anything here
                        // console.log('All constraints for ' + currID + " are not fullfilled!")
                        // break;
                    }
                    //If all constraints for this node are fullfilled, we move once towards the centroid and then break
                    if (constraintsFullfilled[currID].every(d => d.isFulfilled === true)) {
                        moveTowards(polygon, mapPoint, diff, centroid, attractionArray, sourceMatch)
                        break;
                    }

                    let invert = false;
                    let circular = false;
                    let currConstraint = constraintsCurrent[j];
                    let attrIndex = attractionArray.findIndex(d => d.sourceID === currID && d.targetID === currConstraint.targetID)
                    let targetPolygon = polygons.find(d => d.site.originalObject.data.originalData.data.id === currConstraint.targetID)
                    //What to do if polygon target is a cousin
                    if (targetPolygon === undefined) {
                        //different parents
                        targetPolygon = attractionArray[attrIndex].targetPolygon
                    }
                    let targetID = targetPolygon.site.originalObject.data.originalData.data.id
                    let targetParentID = currConstraint.target.parent.data.id
                    let sourceParentID = polygon.site.originalObject.data.originalData.parent.data.id
                    //First check if all conditions are met so that the constraint is fulfilled

                    let flatten_poly_parent = new Polygon(weightedVoronoi.clip())
                    let flatten_poly_target = new Polygon(targetPolygon)
                    let flatten_poly_source = new Polygon(polygon)
                    let flatten_target_point = new Point([targetPolygon.site.centroid[0], targetPolygon.site.centroid[1]])
                    let flatten_source_point = new Point([polygon.site.centroid[0], polygon.site.centroid[1]])
                    let lineSourceTarget = new Segment(flatten_source_point, flatten_target_point);
                    let euclidDist = euclideanDist(polygon.site, targetPolygon.site)
                    // let targetPoint = new Point([targetPolygon.site.x, targetPolygon.site.y])
                    // let sourcePoint = new Point([polygon.site.x, polygon.site.y])

                    //////////
                    //#1 source and target share an edge
                    let currNeighbours = polygon.site.directNeighborsAll
                    let currNeighborObjects = Array.from(polygon.site.directNeighborsAllObjects)
                    let currConstraintIsNeighbour = currNeighbours.has(currConstraint.targetID)
                    let sharedEdgeStatus = 'noSharedEdge'
                    if (currConstraintIsNeighbour) {
                        sharedEdgeStatus = 'SharedEdge'
                    } else {
                        sharedEdgeStatus = 'noSharedEdge'
                    }
                    //////////
                    //#2 neighbourStatus : direct Neighbour, neighbour Across Border
                    let neighbourStatus = 'sameParent'
                    // let currConstraintIsNeighbourOtherParent = currNeighborObjects.filter(d => d.originalObject.data.originalData.parent !== targetParentID)
                    if (sourceParentID !== targetParentID) {
                        neighbourStatus = 'differentParent'
                    } else {
                        neighbourStatus = 'sameParent'
                    }
                    //////////
                    //#3 edgeToOrient: targetVoronoiEdge or parentPolygonEdge(whatever is closer)
                    let edgeToOrient = 'targetVoronoiEdge'
                    let edgeOrientEdge =
                        -1;
                    let midPointOrientEdge = -1;
                    let sourceDistToOrientEdge = -1;
                    let targetDistToOwnPolygonEdge = flatten_poly_target.intersect(lineSourceTarget);
                    if (targetDistToOwnPolygonEdge.length === 0) {
                        console.log("target Polygon does not intersect with line from source to target")
                        targetDistToOwnPolygonEdge = flatten_poly_target.intersect(new Line(flatten_source_point, flatten_target_point));
                    } else {

                    }
                    let cellIntersectionSegmentTargetTarget = flatten_poly_target.findEdgeByPoint(targetDistToOwnPolygonEdge[0])
                    let sourceOrientEdgeClosestPoint = -1;
                    let targetOrientEdgeClosestPoint = flatten_target_point.distanceTo(targetDistToOwnPolygonEdge[0])[0];
                    let orientEdgeVector = -1;
                    let newPointOrthogonalToParent;

                    if (neighbourStatus === 'sameParent') {
                        //if the same parent, we intersect the vector between source and target with the target polygon, and get the edge
                        //This edge is the edge to orient against
                        //Does not matter if we share an edge or not
                        edgeToOrient = 'targetVoronoiEdge'
                        //If the parents differ, it matters
                        // we share an edge, we can simply use the targetVoronoiEdge
                        //Target Edge index is the edge that the vector between the polygons passes through
                        let intersectionPoints = flatten_poly_target.intersect(lineSourceTarget)
                        let cellIntersectionSegmentTarget = flatten_poly_target.findEdgeByPoint(intersectionPoints[0])
                        edgeOrientEdge = cellIntersectionSegmentTarget
                        midPointOrientEdge = edgeOrientEdge.middle()
                        sourceDistToOrientEdge = flatten_source_point.distanceTo(edgeOrientEdge.middle())[0]
                        orientEdgeVector = new Vector(edgeOrientEdge.start, edgeOrientEdge.end)
                    } else if (neighbourStatus === 'differentParent' && sharedEdgeStatus === 'SharedEdge') {
                        //If the parents differ, it matters
                        // we share an edge, we can simply use the targetVoronoiEdge
                        //Target Edge index is the edge that the vector between the polygons passes through

                        //if we do not share an edge, we intersect the vector between source and target with the clipping polyon of the source parent
                        //This edge is the edge to orient against
                        edgeToOrient = 'parentPolygonEdge'
                        let intersectionPoints = flatten_poly_parent.intersect(lineSourceTarget)
                        if (intersectionPoints.length === 0) {
                            console.log("target Polygon does not intersect with line from source to target")
                            intersectionPoints = flatten_poly_target.intersect(new Line(flatten_source_point, flatten_target_point));
                            flatten_poly_parent = flatten_poly_target
                        }
                        let cellIntersectionSegmentTarget = flatten_poly_parent.findEdgeByPoint(intersectionPoints[0])
                        edgeOrientEdge = cellIntersectionSegmentTarget
                        midPointOrientEdge = edgeOrientEdge.middle()
                        //Calculate distance to startPoint of target edge
                        let sourceDistToOrientEdgeStart = flatten_source_point.distanceTo(edgeOrientEdge.start)[0]
                        //Calculate distance to endPoint of target edge
                        let sourceDistToOrientEdgeEnd = flatten_source_point.distanceTo(edgeOrientEdge.end)[0]
                        // sourceDistToOrientEdge = flatten_source_point.distanceTo(edgeOrientEdge.middle())[0]
                        if (sourceDistToOrientEdgeStart < sourceDistToOrientEdgeEnd) {
                            // in case the start is closer, the vector goes from end to start
                            orientEdgeVector = new Vector(edgeOrientEdge.end, edgeOrientEdge.start).normalize()
                        } else {
                            //otherwise from start to end
                            orientEdgeVector = new Vector(edgeOrientEdge.start, edgeOrientEdge.end).normalize()
                        }
                        //newPointOrthogonalToParent = [newPointFlatten.x, newPointFlatten.y]
                        // euclidDist = sourceDistToOrientEdge
                        // orientEdgeVector = new Vector(edgeOrientEdge.start, edgeOrientEdge.end)
                    }


                    ////////
                    //#4 distanceToOrientEdge: in range of [0.5*optimalDist, value, optimalDist * 2]
                    //Calcualte Optimal Edge Length
                    //Calcualte Optimal Distance between target Polygon and current Polygon
                    //Depends on the weight difference between the two Polygons
                    //If both have the same weight, the distance from the current Polygon to the border of the
                    //  target Polygon should be the same as the distance between the target polygon point and its polygon border
                    let targetWeight = targetPolygon.site.originalObject.data.initialWeight
                    let sourceWeight = polygon.site.originalObject.data.initialWeight
                    //Calculate the ratio between target weight and source weight
                    let weightRatio = (1 / targetWeight) * sourceWeight
                    //     //Multiply distance with the ratio
                    let optimalDistance = 40//( sourceDistToOrientEdge + targetOrientEdgeClosestPoint )/2 * weightRatio//sourceDistToOrientEdge * weightRatio

                    ////////
                    //#5 angleBetweenSourceTargetVectorAndBorderEdge
                    //get Position on
                    let sourceToOwnPolygonEdge = flatten_poly_source.intersect(lineSourceTarget);
                    let targetOwnPolygonEdge = flatten_poly_target.intersect(lineSourceTarget);
                    let vectorTarget = new Vector(targetOwnPolygonEdge[0], flatten_target_point).normalize()
                    let vectorSource = new Vector(sourceToOwnPolygonEdge[0], flatten_source_point).normalize()
                    let vectorSourceTarget = new Vector(flatten_source_point, flatten_target_point).normalize()
                    let angleDifference = vectorSource.angleTo(vectorTarget) * (Math.PI / 180.)
                    let shouldMovePerpedicular = false;
                    let vectorAlongParent;
                    let newPoint;
                    let dotProduct;
                    if(neighbourStatus==='differentParent') {
                        let intersectionPoints = flatten_poly_parent.intersect(lineSourceTarget)
                        if (intersectionPoints.length === 0) {
                            console.log("target Polygon does not intersect with line from source to target")
                            intersectionPoints = flatten_poly_target.intersect(new Segment(flatten_source_point, flatten_target_point));
                            flatten_poly_parent = flatten_poly_target
                        }
                        let cellIntersectionSegmentTarget = flatten_poly_parent.findEdgeByPoint(intersectionPoints[0])
                        edgeOrientEdge = cellIntersectionSegmentTarget
                        let segOrientEdge = new Segment(edgeOrientEdge.start, edgeOrientEdge.end)
                        let segIntersectionPointSource = segOrientEdge.distanceTo(flatten_source_point)
                        let segIntersectionPointTarget = segOrientEdge.distanceTo(flatten_target_point)
                        vectorAlongParent = new Vector(segIntersectionPointSource[1].start, segIntersectionPointTarget[1].start)
                        vectorAlongParent = vectorAlongParent.normalize()

                        let newPointFlatte = new Segment(edgeOrientEdge.start, edgeOrientEdge.end)
                        let distToParentOrthogonal = newPointFlatte.distanceTo(flatten_source_point)
                        //     angleDifference = vectorSourceTarget.angleTo(vectorAlongParent) * (Math.PI / 180.)
                        shouldMovePerpedicular = true
                        //use dot product for orthogonal check
                        dotProduct = vectorSourceTarget.dot(vectorAlongParent)
                        angleDifference = Math.abs(Math.acos(dotProduct) * (180 / Math.PI))
                        let newPointFlatten = flatten_source_point.translate(vectorAlongParent.multiply(50))
                        let newVectorSourceTarget = flatten_source_point.translate(vectorSourceTarget.multiply(50))
                        //polygon.site.vectorSourceTarget = new Segment(flatten_source_point, newVectorSourceTarget);
                        polygon.site.vectorAlongParent = new Segment(flatten_source_point, newPointFlatten);
                        // let newPointFlattenTestX = flatten_source_point.x + (vectorAlongParent.x*50);//dx;
                        // console.log(newPointFlattenTestX)
                        newPoint = [newPointFlatten.x, newPointFlatten.y]
                        //if the distance to the vector is sm
                        euclidDist = distToParentOrthogonal[0]
                        // } else {
                        //     // euclidDist = 200
                        // }

                    } else {
                        let newVectorSourceTarget = flatten_source_point.translate(vectorSourceTarget.multiply(50))
                        //polygon.site.vectorSourceTarget = new Segment(flatten_source_point, newVectorSourceTarget);
                        polygon.site.vectorAlongParent = new Segment(flatten_source_point, newVectorSourceTarget);
                        vectorAlongParent = vectorSourceTarget
                    }

                    //Get the source or target of the sourceEdge that is closer to the targetEdge Midpoint
                    //We take the endpoint of that edge that is closer to our targetpolygon as the end

                    //The other is the start
                    //we create a vector and normalize it
                    let vectorAlongLine = new Vector()
                    //We move the point along this vector


                    ///////
                    //#6 freeTargetEdge
                    let targetNeighboursLowerSimilarity = Array.from(targetPolygon.site.directNeighborsAllObjects).filter(d => {
                        let overlap = similarityStore[currConstraint.targetID].constraintsFromChildren.find(e => e[0] === d.originalObject.data.originalData.data.id)
                        if (!overlap || (overlap && overlap[1] < currConstraint.sim)) {
                            return true
                        } else {
                            return false
                        }
                    })

                    currID = polygon.site.originalObject.data.originalData.data.id
                    if (iterationCount > maxIterationCount - 10) {//
                        constraintsFullfilled[polygon.site.id][j] = false
                        currConstraint.isFulfilled = false
                        //moveTowards(polygon, mapPoint, diff, centroid, attractionArray, sourceMatch)
                        //newPoint is combination of direction and centroid
                        let centroidVector = new Vector(new Point(mapPoint.x, mapPoint.y), new Point(centroid[0], centroid[1])).normalize()
                        let addedVector = centroidVector.add(vectorAlongParent.normalize().multiply(2)).normalize()
                        let newAveragedPoint = flatten_source_point.translate(addedVector.multiply(50))
                        newPoint = [newAveragedPoint.x, newAveragedPoint.y]
                        moveTowards(polygon, mapPoint, diff, centroid)
                        break;
                    } else if (iterationCount > maxIterationCount - 35 && polygon.site.previousWeight < polygon.site.weight) {//
                        constraintsFullfilled[polygon.site.id][j] = false
                        currConstraint.isFulfilled = false
                        //moveTowards(polygon, mapPoint, diff, centroid, attractionArray, sourceMatch)
                        //newPoint is combination of direction and centroid
                        let centroidVector = new Vector(new Point(mapPoint.x, mapPoint.y), new Point(centroid[0], centroid[1])).normalize()
                        let addedVector = centroidVector.add(vectorAlongParent.normalize().multiply(2)).normalize()
                        let newAveragedPoint = flatten_source_point.translate(addedVector.multiply(50))
                        newPoint = [newAveragedPoint.x, newAveragedPoint.y]
                        moveTowardsAttraction(polygon, attractionArray, attrIndex, mapPoint, centroid, targetPolygon, diff, invert, circular, newPoint, addedVector, euclidDist)
                        break;
                    } else {

                        currID = polygon.site.originalObject.data.originalData.data.id
                        if (sharedEdgeStatus === 'SharedEdge' && neighbourStatus === 'differentParent') {// && neighbourStatus === 'differentParent'
                            if (euclidDist <= optimalDistance * 2) { //optimalDistance <= euclidDist && euclidDist <= optimalDistance * 2 && angleDifference > 5
                                //move perpendicular to edge
                                let didMove = false;
                                // let newPoint = getCircularPosition(currConstraint.distSourceTarget, 10, currConstraint.targetPos);
                                circular = true;
                                if (countMovements === 0) {
                                    didMove = moveTowardsAttraction(polygon, attractionArray, attrIndex, mapPoint, centroid, targetPolygon, diff, invert, circular, newPoint, vectorAlongParent, euclidDist)
                                }
                                constraintsFullfilled[polygon.site.id][j] = false
                                currConstraint.isFulfilled = false
                                if (didMove) {
                                    countMovements++;
                                } else {
                                    constraintsFullfilled[polygon.site.id][j] = true
                                    currConstraint.isFulfilled = true
                                }

                            } else if (sharedEdgeStatus === 'SharedEdge' && optimalDistance <= euclidDist && euclidDist <= optimalDistance*2 && angleDifference <= 15) {
                                //move straight towards
                                let didMove = false;
                                if (countMovements === 0) {
                                    didMove = moveTowardsAttraction(polygon, attractionArray, attrIndex, mapPoint, centroid, targetPolygon, diff, invert)
                                }
                                constraintsFullfilled[polygon.site.id][j] = false
                                currConstraint.isFulfilled = false
                                if (didMove) {
                                    countMovements++;
                                }

                            } else if (sharedEdgeStatus === 'SharedEdge' && euclidDist > optimalDistance * 2) {
                                //move straight towards
                                let didMove = false;
                                if (countMovements === 0) {
                                    didMove = moveTowardsAttraction(polygon, attractionArray, attrIndex, mapPoint, centroid, targetPolygon, diff, invert)
                                }
                                constraintsFullfilled[polygon.site.id][j] = false
                                currConstraint.isFulfilled = false
                                if (didMove) {
                                    countMovements++;
                                }

                            } else if (sharedEdgeStatus === 'SharedEdge') {
                                //move towards centroid
                                let didMove = false;
                                constraintsFullfilled[polygon.site.id][j] = true
                                currConstraint.isFulfilled = true
                            }
                        } else if(sharedEdgeStatus === 'noSharedEdge') {

                            if (sharedEdgeStatus === 'noSharedEdge' && targetNeighboursLowerSimilarity.length === 0 && currNeighbours.length > 10) {
                                //move towards centroid
                                let didMove = false;
                                constraintsFullfilled[polygon.site.id][j] = true
                                currConstraint.isFulfilled = true
                            } else if (sharedEdgeStatus === 'noSharedEdge' && optimalDistance * 0.5 <= euclidDist && euclidDist <= optimalDistance && angleDifference > 15 && neighbourStatus !== 'differentParent') {
                                let didMove = false;
                                // let newPoint = getCircularPosition(currConstraint.distSourceTarget, 10, currConstraint.targetPos);
                                circular = true;
                                if (countMovements === 0) {
                                    didMove = moveTowardsAttraction(polygon, attractionArray, attrIndex, mapPoint, centroid, targetPolygon, diff, invert, circular, newPoint, vectorAlongParent, euclidDist)
                                }
                                constraintsFullfilled[polygon.site.id][j] = false
                                currConstraint.isFulfilled = false
                                if (didMove) {
                                    countMovements++;
                                } else {
                                    constraintsFullfilled[polygon.site.id][j] = true
                                    currConstraint.isFulfilled = true
                                }

                            } else if (sharedEdgeStatus === 'noSharedEdge' && optimalDistance <= euclidDist && targetNeighboursLowerSimilarity.length > 0) {
                                //move straight towards
                                let didMove = false;
                                if (countMovements === 0) {
                                    didMove = moveTowardsAttraction(polygon, attractionArray, attrIndex, mapPoint, centroid, targetPolygon, diff, invert)
                                }
                                constraintsFullfilled[polygon.site.id][j] = false
                                currConstraint.isFulfilled = false
                                if (didMove) {
                                    countMovements++;
                                }

                            } else if (sharedEdgeStatus === 'noSharedEdge' && euclidDist > optimalDistance && neighbourStatus === 'differentParent') {
                                //move straight towards
                                let didMove = false;
                                if (countMovements === 0) {
                                    didMove = moveTowardsAttraction(polygon, attractionArray, attrIndex, mapPoint, centroid, targetPolygon, diff, invert)
                                }
                                constraintsFullfilled[polygon.site.id][j] = false
                                currConstraint.isFulfilled = false
                                if (didMove) {
                                    countMovements++;
                                }

                            } else if (sharedEdgeStatus === 'noSharedEdge' && euclidDist <= optimalDistance && neighbourStatus === 'differentParent' && angleDifference > 15) {
                                //move towards centroid
                                let didMove = false;
                                if (countMovements === 0) {
                                    didMove = moveTowardsAttraction(polygon, attractionArray, attrIndex, mapPoint, centroid, targetPolygon, diff, invert, circular, newPoint, vectorAlongParent, euclidDist)
                                }
                                constraintsFullfilled[polygon.site.id][j] = false
                                currConstraint.isFulfilled = false

                            } else {
                                constraintsFullfilled[polygon.site.id][j] = true
                                currConstraint.isFulfilled = true

                            }
                        }
                    }
                }
                // console.log("error"+countMovements)
                if (countMovements === 0) {
                    moveTowards(polygon, mapPoint, diff, centroid, attractionArray, sourceMatch)
                }
                //How can there be large movement?
                //if there was no optimization step

            } else {
                //No attraction, just move
                moveTowards(polygon, mapPoint, diff, centroid, attractionArray, sourceMatch)
            }
            //Check if any of the points are not inside
            newMapPoints.push(mapPoint);

        }
        handleOverweighted(newMapPoints);
    }

    function getEdges(points) {
        const edges = []

        for (let i = 0; i < points.length - 1; i++) {
            for (let j = 0; j < points.length; j++) {
                edges.push([points[i], points[j]])
            }
        }
        edges.push([points[0], points[points.length - 1]])
        return edges
    }

    function getAdjacent(current, others) {
        const return_list = new Set()
        for (const other of others) {
            for (const edge_other of getEdges(other.polygon)) {
                if ('initialPos' in current.data && 'polygon' in current.data.initialPos) {
                    for (const edge_current of getEdges(current.data.initialPos.polygon)) {
                        const [start_other, end_other] = edge_other
                        const [start_current, end_current] = edge_current

                        const intersects = intersect(...start_other, ...end_other, ...start_current, ...end_current)

                        if (intersects) {
                            return_list.add(other)
                        }
                    }
                } else {
                    console.log("cannot find polygon")
                }
            }
        }
        return return_list
    }

    function adaptWeights(polygons, flickeringMitigationRatio) {
        var newMapPoints = [],
            flickeringInfluence = 0.1;
        var flickeringMitigation, polygon, mapPoint, currentArea, adaptRatio, adaptedWeight;

        flickeringMitigation = flickeringInfluence * flickeringMitigationRatio;
        for (var i = 0; i < siteCount; i++) {
            polygon = polygons[i];
            mapPoint = polygon.site.originalObject;
            if (isNaN(mapPoint.weight)) {
                console.log("weight became NaN!")
            }
            currentArea = d3PolygonArea(polygon);
            adaptRatio = mapPoint.targetedArea / currentArea;

            //begin: handle excessive change;
            adaptRatio = Math.max(adaptRatio, 1 - flickeringInfluence + flickeringMitigation); // in [(1-flickeringInfluence), 1]
            adaptRatio = Math.min(adaptRatio, 1 + flickeringInfluence - flickeringMitigation); // in [1, (1+flickeringInfluence)]
            //end: handle excessive change;

            adaptedWeight = mapPoint.weight * adaptRatio;
            // adaptedWeight = Math.max(adaptedWeight, epsilon);

            mapPoint.weight = adaptedWeight;
            if (isNaN(mapPoint.weight)) {
                console.log("weight became NaN!")
            }

            newMapPoints.push(mapPoint);
        }

        handleOverweighted(newMapPoints);
    }

    // heuristics: lower heavy weights
    function handleOverweighted0(mapPoints) {
        var fixCount = 0;
        var fixApplied, tpi, tpj, weightest, lightest, sqrD, adaptedWeight;
        do {
            if (fixCount > HANLDE_OVERWEIGHTED_MAX_ITERATION_COUNT) {
                return
                // throw new d3VoronoiMapError('handleOverweighted0 is looping too much');
            }
            fixApplied = false;
            for (var i = 0; i < siteCount; i++) {
                tpi = mapPoints[i];
                for (var j = i + 1; j < siteCount; j++) {
                    tpj = mapPoints[j];
                    if (tpi.weight > tpj.weight) {
                        weightest = tpi;
                        lightest = tpj;
                    } else {
                        weightest = tpj;
                        lightest = tpi;
                    }
                    sqrD = squaredDistance(tpi, tpj);
                    if (sqrD < weightest.weight - lightest.weight) {
                        adaptedWeight = sqrD - epsilon; // as in ArlindNocaj/Voronoi-Treemap-Library
                        // adaptedWeight = sqrD + lightest.weight - epsilon; // works, but below heuristics performs better (less flickering)
                        // adaptedWeight = sqrD + lightest.weight / 2;
                        adaptedWeight = Math.max(adaptedWeight, epsilon);
                        weightest.weight = weightest.data.initialWeight;
                        fixApplied = true;
                        fixCount++;
                        break;
                    }
                }
                if (fixApplied) {
                    break;
                }
            }
        } while (fixApplied);

        /*
        if (fixCount > 0) {
          console.log('# fix: ' + fixCount);
        }
        */
    }

    // heuristics: increase light weights
    function handleOverweighted1(mapPoints) {
        var fixCount = 0;
        var fixApplied, tpi, tpj, weightest, lightest, sqrD, overweight;
        do {
            if (fixCount > HANLDE_OVERWEIGHTED_MAX_ITERATION_COUNT) {
                throw new d3VoronoiMapError('handleOverweighted1 is looping too much');
            }
            fixApplied = false;
            for (var i = 0; i < siteCount; i++) {
                tpi = mapPoints[i];
                for (var j = i + 1; j < siteCount; j++) {
                    tpj = mapPoints[j];
                    if (tpi.weight > tpj.weight) {
                        weightest = tpi;
                        lightest = tpj;
                    } else {
                        weightest = tpj;
                        lightest = tpi;
                    }
                    sqrD = squaredDistance(tpi, tpj);
                    if (sqrD < weightest.weight - lightest.weight) {
                        overweight = weightest.weight - lightest.weight - sqrD;
                        lightest.weight += overweight + epsilon;
                        fixApplied = true;
                        fixCount++;
                        break;
                    }
                }
                if (fixApplied) {
                    break;
                }
            }
        } while (fixApplied);

        /*
        if (fixCount > 0) {
          console.log('# fix: ' + fixCount);
        }
        */
    }

    function computeAreaError(polygons) {
        //convergence based on summation of all sites current areas
        var areaErrorSum = 0;
        var polygon, mapPoint, currentArea;
        for (var i = 0; i < siteCount; i++) {
            if (i < polygons.length) {
                polygon = polygons[i];
                if ('site' in polygon) {
                    mapPoint = polygon.site.originalObject;
                } else {
                    mapPoint = polygon.site.originalObject;
                    console.log("error")
                }
                currentArea = d3PolygonArea(polygon);
                areaErrorSum += Math.abs(mapPoint.targetedArea - currentArea);
            }
        }
        return areaErrorSum;
    }

    function setHandleOverweighted() {
        switch (HANDLE_OVERWEIGHTED_VARIANT) {
            case 0:
                handleOverweighted = handleOverweighted0;
                break;
            case 1:
                handleOverweighted = handleOverweighted1;
                break;
            default:
                console.error("unknown 'handleOverweighted' variant; using variant #1");
                handleOverweighted = handleOverweighted0;
        }
    }

    const getCircularPosition = function (radius, angle, circleCenter) {

        // evenly spaces nodes along arc
        angle = angle * (Math.PI / 180); // Convert from Degrees to Radians
        const x = circleCenter[0] + radius * Math.cos(angle);
        const y = circleCenter[1] + radius * Math.sin(angle);
        return {x, y};
    };

    return simulation;
}
