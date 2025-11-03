(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3-polygon'), require('d3-timer'), require('d3-dispatch'), require('d3-weighted-voronoi')) :
        typeof define === 'function' && define.amd ? define(['exports', 'd3-polygon', 'd3-timer', 'd3-dispatch', 'd3-weighted-voronoi'], factory) :
            (factory((global.d3 = global.d3 || {}), global.d3, global.d3, global.d3, global.d3));
}(this, function (exports, d3Polygon, d3Timer, d3Dispatch, d3WeightedVoronoi) {
    'use strict';

    function FlickeringMitigation() {
        /////// Inputs ///////
        this.growthChangesLength = DEFAULT_LENGTH;
        this.totalAvailableArea = NaN;

        //begin: internals
        this.lastAreaError = NaN;
        this.lastGrowth = NaN;
        this.growthChanges = [];
        this.growthChangeWeights = generateGrowthChangeWeights(this.growthChangesLength); //used to make recent changes weighter than older changes
        this.growthChangeWeightsSum = computeGrowthChangeWeightsSum(this.growthChangeWeights);
        //end: internals
    }

    var DEFAULT_LENGTH = 10;

    function direction(h0, h1) {
        return (h0 >= h1) ? 1 : -1;
    }

    function generateGrowthChangeWeights(length) {
        var initialWeight = 3;   // a magic number
        var weightDecrement = 1; // a magic number
        var minWeight = 1;

        var weightedCount = initialWeight;
        var growthChangeWeights = [];

        for (var i = 0; i < length; i++) {
            growthChangeWeights.push(weightedCount);
            weightedCount -= weightDecrement;
            if (weightedCount < minWeight) {
                weightedCount = minWeight;
            }
        }
        return growthChangeWeights;
    }

    function computeGrowthChangeWeightsSum(growthChangeWeights) {
        var growthChangeWeightsSum = 0;
        for (var i = 0; i < growthChangeWeights.length; i++) {
            growthChangeWeightsSum += growthChangeWeights[i];
        }
        return growthChangeWeightsSum;
    }

    ///////////////////////
    ///////// API /////////
    ///////////////////////

    FlickeringMitigation.prototype.reset = function () {
        this.lastAreaError = NaN;
        this.lastGrowth = NaN;
        this.growthChanges = [];
        this.growthChangesLength = DEFAULT_LENGTH;
        this.growthChangeWeights = generateGrowthChangeWeights(this.growthChangesLength);
        this.growthChangeWeightsSum = computeGrowthChangeWeightsSum(this.growthChangeWeights);
        this.totalAvailableArea = NaN;

        return this;
    };

    FlickeringMitigation.prototype.clear = function () {
        this.lastAreaError = NaN;
        this.lastGrowth = NaN;
        this.growthChanges = [];

        return this;
    };

    FlickeringMitigation.prototype.length = function (_) {
        if (!arguments.length) {
            return this.growthChangesLength;
        }

        if (parseInt(_) > 0) {
            this.growthChangesLength = Math.floor(parseInt(_));
            this.growthChangeWeights = generateGrowthChangeWeights(this.growthChangesLength);
            this.growthChangeWeightsSum = computeGrowthChangeWeightsSum(this.growthChangeWeights);
        } else {
            console.warn("FlickeringMitigation.length() accepts only positive integers; unable to handle " + _);
        }
        return this;
    };

    FlickeringMitigation.prototype.totalArea = function (_) {
        if (!arguments.length) {
            return this.totalAvailableArea;
        }

        if (parseFloat(_) > 0) {
            this.totalAvailableArea = parseFloat(_);
        } else {
            console.warn("FlickeringMitigation.totalArea() accepts only positive numbers; unable to handle " + _);
        }
        return this;
    };

    FlickeringMitigation.prototype.add = function (areaError) {
        var secondToLastAreaError, secondToLastGrowth;

        secondToLastAreaError = this.lastAreaError;
        this.lastAreaError = areaError;
        if (!isNaN(secondToLastAreaError)) {
            secondToLastGrowth = this.lastGrowth;
            this.lastGrowth = direction(this.lastAreaError, secondToLastAreaError);
        }
        if (!isNaN(secondToLastGrowth)) {
            this.growthChanges.unshift(this.lastGrowth != secondToLastGrowth);
        }

        if (this.growthChanges.length > this.growthChangesLength) {
            this.growthChanges.pop();
        }
        return this;
    };

    FlickeringMitigation.prototype.ratio = function () {
        var weightedChangeCount = 0;
        var ratio;

        if (this.growthChanges.length < this.growthChangesLength) {
            return 0;
        }
        if (this.lastAreaError > this.totalAvailableArea / 10) {
            return 0;
        }

        for (var i = 0; i < this.growthChangesLength; i++) {
            if (this.growthChanges[i]) {
                weightedChangeCount += this.growthChangeWeights[i];
            }
        }

        ratio = weightedChangeCount / this.growthChangeWeightsSum;

        /*
        if (ratio>0) {
          console.log("flickering mitigation ratio: "+Math.floor(ratio*1000)/1000);
        }
        */

        return ratio;
    };

    function randomInitialPosition() {

        //begin: internals
        var clippingPolygon,
            extent,
            minX, maxX,
            minY, maxY,
            dx, dy;
        //end: internals

        ///////////////////////
        ///////// API /////////
        ///////////////////////

        function _random(d, i, arr, voronoiMapSimulation) {
            var shouldUpdateInternals = false;
            var x, y;

            if (clippingPolygon !== voronoiMapSimulation.clip()) {
                clippingPolygon = voronoiMapSimulation.clip();
                extent = voronoiMapSimulation.extent();
                shouldUpdateInternals = true;
            }

            if (shouldUpdateInternals) {
                updateInternals();
            }

            x = minX + dx * voronoiMapSimulation.prng()();
            y = minY + dy * voronoiMapSimulation.prng()();
            while (!d3Polygon.polygonContains(clippingPolygon, [x, y])) {
                x = minX + dx * voronoiMapSimulation.prng()();
                y = minY + dy * voronoiMapSimulation.prng()();
            }
            return [x, y];
        };

        ///////////////////////
        /////// Private ///////
        ///////////////////////

        function updateInternals() {
            minX = extent[0][0];
            maxX = extent[1][0];
            minY = extent[0][1];
            maxY = extent[1][1];
            dx = maxX - minX;
            dy = maxY - minY;
        };

        return _random;
    };

    function pie() {
        //begin: internals
        var startAngle = 0;
        var clippingPolygon,
            dataArray,
            dataArrayLength,
            clippingPolygonCentroid,
            halfIncircleRadius,
            angleBetweenData;
        //end: internals

        ///////////////////////
        ///////// API /////////
        ///////////////////////

        function _pie(d, i, arr, voronoiMapSimulation) {
            var shouldUpdateInternals = false;

            if (clippingPolygon !== voronoiMapSimulation.clip()) {
                clippingPolygon = voronoiMapSimulation.clip();
                shouldUpdateInternals |= true;
            }
            if (dataArray !== arr) {
                dataArray = arr;
                shouldUpdateInternals |= true;
            }

            if (shouldUpdateInternals) {
                updateInternals();
            }

            // add some randomness to prevent colinear/cocircular points
            // substract -0.5 so that the average jitter is still zero
            return [
                clippingPolygonCentroid[0] + Math.cos(startAngle + i * angleBetweenData) * halfIncircleRadius + (voronoiMapSimulation.prng()() - 0.5) * 1E-3,
                clippingPolygonCentroid[1] + Math.sin(startAngle + i * angleBetweenData) * halfIncircleRadius + (voronoiMapSimulation.prng()() - 0.5) * 1E-3
            ];
        };

        _pie.startAngle = function (_) {
            if (!arguments.length) {
                return startAngle;
            }

            startAngle = _;
            return _pie;
        };

        ///////////////////////
        /////// Private ///////
        ///////////////////////

        function updateInternals() {
            clippingPolygonCentroid = d3Polygon.polygonCentroid(clippingPolygon);
            halfIncircleRadius = computeMinDistFromEdges(clippingPolygonCentroid, clippingPolygon) / 2;
            dataArrayLength = dataArray.length;
            angleBetweenData = 2 * Math.PI / dataArrayLength;
        };

        function computeMinDistFromEdges(vertex, clippingPolygon) {
            var minDistFromEdges = Infinity,
                edgeIndex = 0,
                edgeVertex0 = clippingPolygon[clippingPolygon.length - 1],
                edgeVertex1 = clippingPolygon[edgeIndex];
            var distFromCurrentEdge;

            while (edgeIndex < clippingPolygon.length) {
                distFromCurrentEdge = vDistance(vertex, edgeVertex0, edgeVertex1);
                if (distFromCurrentEdge < minDistFromEdges) {
                    minDistFromEdges = distFromCurrentEdge;
                }
                edgeIndex++;
                edgeVertex0 = edgeVertex1;
                edgeVertex1 = clippingPolygon[edgeIndex];
            }

            return minDistFromEdges;
        }

        //from https://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
        function vDistance(vertex, edgeVertex0, edgeVertex1) {
            var x = vertex[0],
                y = vertex[1],
                x1 = edgeVertex0[0],
                y1 = edgeVertex0[1],
                x2 = edgeVertex1[0],
                y2 = edgeVertex1[1];
            var A = x - x1,
                B = y - y1,
                C = x2 - x1,
                D = y2 - y1;
            var dot = A * C + B * D;
            var len_sq = C * C + D * D;
            var param = -1;

            if (len_sq != 0) //in case of 0 length line
                param = dot / len_sq;

            var xx, yy;

            if (param < 0) { // this should not arise as clippingpolygon is convex
                xx = x1;
                yy = y1;
            } else if (param > 1) { // this should not arise as clippingpolygon is convex
                xx = x2;
                yy = y2;
            } else {
                xx = x1 + param * C;
                yy = y1 + param * D;
            }

            var dx = x - xx;
            var dy = y - yy;
            return Math.sqrt(dx * dx + dy * dy);
        }

        return _pie;
    }

    function halfAverageAreaInitialWeight() {
        //begin: internals
        var clippingPolygon,
            dataArray,
            siteCount,
            totalArea,
            halfAverageArea;
        //end: internals

        ///////////////////////
        ///////// API /////////
        ///////////////////////
        function _halfAverageArea(d, i, arr, voronoiMapSimulation) {
            var shouldUpdateInternals = false;
            if (clippingPolygon !== voronoiMapSimulation.clip()) {
                clippingPolygon = voronoiMapSimulation.clip();
                shouldUpdateInternals |= true;
            }
            if (dataArray !== arr) {
                dataArray = arr;
                shouldUpdateInternals |= true;
            }

            if (shouldUpdateInternals) {
                updateInternals();
            }

            return halfAverageArea;
        };

        ///////////////////////
        /////// Private ///////
        ///////////////////////

        function updateInternals() {
            siteCount = dataArray.length;
            totalArea = d3Polygon.polygonArea(clippingPolygon);
            halfAverageArea = totalArea / siteCount / 2; // half of the average area of the the clipping polygon
        }

        return _halfAverageArea;
    };

    // from https://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
    // (above link provided by https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)

    function d3VoronoiMapError(message) {
        this.message = message;
        this.stack = new Error().stack;
    }

    d3VoronoiMapError.prototype.name = 'd3VoronoiMapError';
    d3VoronoiMapError.prototype = new Error();

    function voronoiMapSimulation(data) {
        //begin: constants
        var DEFAULT_CONVERGENCE_RATIO = 0.01;
        var DEFAULT_MAX_ITERATION_COUNT = 20;
        var DEFAULT_MIN_WEIGHT_RATIO = 0.01;
        var DEFAULT_PRNG = Math.random;
        var DEFAULT_INITIAL_POSITION = randomInitialPosition();
        var DEFAULT_INITIAL_WEIGHT = halfAverageAreaInitialWeight();
        var RANDOM_INITIAL_POSITION = randomInitialPosition();
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
        var similarity = DEFAULT_SIMILARITY; // maximum allowed iteration; stops computation even if convergence is not reached; use a large amount for a sole converge-based computation stop
        var attractionArray = [];
        var constraintsFullfilled = {};

        //begin: internals
        var weightedVoronoi = d3WeightedVoronoi.weightedVoronoi(),
            flickeringMitigation = new FlickeringMitigation(),
            shouldInitialize = true, // should initialize due to changes via APIs
            siteCount, // number of sites
            totalArea, // area of the clipping polygon
            areaErrorTreshold, // targeted allowed area error (= totalArea * convergenceRatio); below this treshold, map is considered obtained and computation stops
            iterationCount, // current iteration
            polygons, // current computed polygons
            clippingPolygon,
            areaError, // current area error
            converged, // true if (areaError < areaErrorTreshold)
            ended; // stores if computation is ended, either if computation has converged or if it has reached the maximum allowed iteration
        //end: internals
        //being: internals/simulation
        var simulation,
            stepper = d3Timer.interval(step, 300),
            event = d3Dispatch.dispatch('beforeTick', 'tick', 'end');
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
            beforeTick: beforeTick,
            tick: tick,
            step: step,

            restart: function () {
                stepper.restart(step);
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

                weightedVoronoi.clip(_);
                clippingPolygon = _;
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

            initialPosition: function (_) {
                if (!arguments.length) {
                    return initialPosition;
                }

                initialPosition = _;
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
            },

            similarity: function (_) {
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
            constraintsFullfilled: function (_) {
                if (!arguments.length) {
                    return constraintsFullfilled;
                }

                constraintsFullfilled = _;
                return simulation;
            },
        };

        ///////////////////////
        /////// Private ///////
        ///////////////////////

        //begin: simulation's main loop
        function step() {
            event.call('beforeTick', simulation);
            tick();
            event.call('tick', simulation);
            if (ended) {
                stepper.stop();
                event.call('end', simulation);
            }
        }

        //end: simulation's main loop

        function beforeTick() {

        }

        //begin: algorithm used at each iteration
        function tick() {
            if (!ended) {
                if (shouldInitialize) {
                    initializeSimulation();
                }
                polygons = adapt(polygons, flickeringMitigation.ratio());
                iterationCount++;
                areaError = computeAreaError(polygons);
                flickeringMitigation.add(areaError);
                converged = areaError < areaErrorTreshold - 0.1;
                if (attractionArray.length > 0 && attractionArray.every(d => d.isFullfilled) && iterationCount > 10) { //attractionArray.length > 0 && attractionArray.every(d => d.isFulfilled) && iterationCount > 10
                    ended = iterationCount >= maxIterationCount | converged;
                } else {
                    ended = iterationCount >= maxIterationCount;
                }
                // console.log("error %: "+Math.round(areaError*100*1000/totalArea)/1000);
            } else {
                event.call('end', simulation);
            }
        }

        //end: algorithm used at each iteration

        function initializeSimulation() {
            //begin: handle algorithm's variants
            setHandleOverweighted();
            //end: handle algorithm's variants

            siteCount = data.length;
            totalArea = Math.abs(d3Polygon.polygonArea(weightedVoronoi.clip()));
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
                console.log("Cannot compute Convex Hull")
                throw new Error('Cannot compute Convex Hull');
            }
            return polygons;
        }

        function createMapPoints(basePoints, simulation) {
            var totalWeight = basePoints.reduce(function (acc, bp) {
                return (acc += bp.weight);
            }, 0);
            var initialPosition;

            return basePoints.map(function (bp, i, bps) {
                initialPosition = bp.initialPosition;

                if (!d3Polygon.polygonContains(weightedVoronoi.clip(), initialPosition)) {
                    initialPosition = DEFAULT_INITIAL_POSITION(bp, i, bps, simulation);
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
            let oldEdges = [];
            if (similarity) {
                polygons.map(function (d) {
                    d.site.originalObject.connectivity = d.site.propertiesNeighboursClipped;
                    return d;
                })
                oldEdges = calculateEdges(polygons);
            }

            adaptPositions(polygons, flickeringMitigationRatio, attractionArray);
            adaptedMapPoints = polygons.map(function (p) {
                return p.site.originalObject;
            });
            try {
                polygons = weightedVoronoi(adaptedMapPoints);
            } catch (error) {
                console.log("Cannot compute Convex Hull")
                throw new d3VoronoiMapError('Cannot compute Convex Hull');
            }
            if (polygons.length < siteCount) {
                throw new d3VoronoiMapError('at least 1 site has no area, which is not supposed to arise');
            }

            // if(attractionArray.length > 0){
            //   console.log('attract')
            //   adaptPositionsSimilarity(polygons, flickeringMitigationRatio, attractionArray)
            //   adaptedMapPoints = polygons.map(function (p) {
            //     return p.site.originalObject;
            //   });
            // }

            //Only do weighted optimization after the convergence hast reached about half
            if (attractionArray.length > 0 && attractionArray.every(d => d.isFullfilled) && iterationCount > 20) {
                adaptWeights(polygons, flickeringMitigationRatio);
                adaptedMapPoints = polygons.map(function (p) {
                    return p.site.originalObject;
                });
                polygons = weightedVoronoi(adaptedMapPoints);
            }

            if (polygons.length < siteCount) {
                throw new d3VoronoiMapError('at least 1 site has no area, which is not supposed to arise');
            }

            //nodes that have a pair should move towards thei paired partnernode position
            //these nodes could also be outside of their current coordinate system
            //


            // if(similarity && polygons[0].site.originalObject.hasOwnProperty('connectivity')){
            //
            //   //loop over all edges
            //   //get length of all edges
            //   //proportional to the length of the edge,
            //   //undo the movement of the affectend centroids
            //   //move at least the affected centroid towards the edge
            //
            //   //Problem: how do we get the edges?
            //
            //
            //   let r = polygons.every(function (d) {
            //     let disconnected = []
            //     for (let i = 0; i < d.site.originalObject.connectivity.length; i++) {
            //       if (d.site.propertiesNeighboursClipped[i] !== undefined &&
            //           d.site.propertiesNeighboursClipped[i].hasOwnProperty('id') &&
            //           d.site.originalObject.connectivity[i].id !== d.site.propertiesNeighboursClipped[i].id) {
            //         disconnected.push(i);
            //       }
            //     }
            //     if(disconnected.length > 0){
            //       //need to undo last move
            //       let newEdges = calculateEdges(polygons)
            //       console.log('changed n')
            //       // console.log(newEdges)
            //       // console.log(oldEdges)
            //       //adaptPositionsSimilarity(polygons, flickeringMitigationRatio, result);
            //       // adaptedMapPoints = polygons.map(function (p) {
            //       //   return p.site.originalObject;
            //       // });
            //       //for every neigbour that has changed
            //       //we move the corresponding nodes towards each other
            //
            //
            //     } else {
            //      // console.log('same n')
            //
            //     }
            //   })
            // }

            return polygons;
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

        function checkNeighbours(polygons) {
            let newMapPoints = [],
                flickeringInfluence = 0.5;
            let flickeringMitigation, d, polygon, mapPoint, centroid, dx, dy;

            siteCount = polygons.length;
            for (var i = 0; i < siteCount; i++) {
                polygon = polygons[i];
                mapPoint = polygon.site.originalObject;
                centroid = d3Polygon.polygonCentroid(polygon);

                //ShouldMove shows if a neighbour is a current neighbour
                let shouldMove = Array(mapPoint.data.originalData.length).fill(false);
                let connections = new Map();
                let shouldMove2 = Array(mapPoint.data.originalData.length).fill(false);

                //check if still connected to neighbour
                //if (mapPoint.data.originalData.id.length > 1) {
                let array = mapPoint.data.originalData.labels;
                let comb;
                //if (mapPoint.data.originalData.labels.length > 1){
                // if(polygons.length > 5){//6
                //   comb= k_combinations(array,  1);
                // } else {
                //   comb= [];
                // }
                // for (let idx in comb) {
                //   if (comb[idx].length > 1) {
                //     comb[idx] = comb[idx].join('');
                //   }
                //   shouldMove[idx] = polygon.site.neighbours.some(
                //       function(d){
                //         if( d.originalObject.data.originalData.id.startsWith(comb[idx]) === true){
                //           return true;
                //         }else {
                //           return false;
                //         }
                //       }
                //   );
                // }

                //Right now its random, but should maybe prefer to be connected to its closest neighbour

                //get length of every current neighbour
                //if lenght is small, the centroid should move in the direction of the line/tangent of the line
                // shouldMove2 = propertiesNeighboursClipped.every(function(e){
                //       if(polygon.site.neighbours.some(
                //           d => d.originalObject.data.originalData.labels.includes(e[0])=== true
                //               && d.originalObject.data.originalData.labels.length - array.length-1 === 0// Should stay connected to at least one hierarchy above neighbour
                //       )){
                //         connections.set(e[0], true);
                //         return true;
                //       }else {
                //         connections.set(e[0], false);
                //         return false;
                //       }
                //     }
                // );
                // polygon.site.originalObject.data.notConnected = shouldMove2;
                polygon.site.originalObject.data.connectivity = propertiesNeighboursClipped;
                if (!shouldMove2) {//shouldMove.includes(false)
                    polygon.site.originalObject.data.notConnected = false;
                    // polygon.site.x = polygon.site.originalObject.data.originalData.previousX;
                    // polygon.site.y = polygon.site.originalObject.data.originalData.previousY;
                    // mapPoint.x = polygon.site.originalObject.data.originalData.previousX;
                    // mapPoint.y = polygon.site.originalObject.data.originalData.previousY;
                    //onsole.log(polygon.site.originalObject.data.originalData.id + " does not  satisfy constraint")
                }
                //}

                //newMapPoints.push(mapPoint);
            }
            //handleOverweighted(newMapPoints);
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
                centroid = d3Polygon.polygonCentroid(polygon);
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
                    // dx = centroid[0] - mapPoint.x;
                    // dy = centroid[1] - mapPoint.y;
                    d = 20
                    // targetPoint = [dx[0]*distance+polygon.site.x, dx[1]*eDistAtoB + polygon.site.y]
                    //begin: handle excessive change;
                    dx *= d;
                    dy *= d;
                    mapPoint.x += dx;
                    mapPoint.y += dy;
                }

                // mapPoint.x = Math.min(Math.max(mapPoint.x, 500), 1000);
                // mapPoint.y = Math.min(Math.max(mapPoint.y, 500), 1000);
                newMapPoints.push(mapPoint);
            }

            handleOverweighted(newMapPoints);
        }

        // function adaptPositionsSimilarity(polygons, flickeringMitigationRatio, disconnected) {
        //   var newMapPoints = [],
        //       flickeringInfluence = 0.5;
        //   var flickeringMitigation, d, polygon, mapPoint, centroid;
        //   var dx = 0;
        //   var dy = 0;
        //   let scale = d3.scaleLinear()
        //       .domain([1, 6])
        //       .range([1, 0.2]);
        //
        //   flickeringMitigation = flickeringInfluence * flickeringMitigationRatio;
        //   d = 1 - flickeringMitigation *0.5; // in [0.5, 1]
        //   siteCount = polygons.length;
        //
        //   for (var i = 0; i < siteCount; i++) {
        //     polygon = polygons[i];
        //     mapPoint = polygon.site.originalObject;
        //     centroid = d3Polygon.polygonCentroid(polygon);
        //     if(polygon.site.originalObject.data.hasOwnProperty('notConnected') && polygon.site.originalObject.data.notConnected === false
        //         && polygon.site.originalObject.data.originalData.id.length > 1
        //         && polygon.site.weight > 0
        //     ) {//shouldMove.includes(false)
        //       let closestFar = [];
        //       for(let id of polygon.site.originalObject.data.originalData.labels){
        //         //get closest and most similiar object, we use the first part which is connected
        //         //let stringClosest = polygon.site.originalObject.data.originalData.id.slice(0, -1);
        //         let closest = polygons.filter(function(d){
        //           return d.site.originalObject.data.originalData.labels.includes(id) === true &&
        //               d.site.originalObject.data.originalData.id != polygon.site.originalObject.data.originalData.id
        //               && polygon.site.originalObject.data.connectivity.get(id) === false
        //           //     & d.site.originalObject.data.originalData.id != polygon.site.originalObject.data.originalData.id
        //           // return (
        //           //     //polygon.site.originalObject.data.hasOwnProperty('connectivity')
        //           //  // & polygon.site.originalObject.data.connectivity.get(id) === false &
        //           //    d.site.originalObject.data.originalData.id === String(id))
        //         });
        //         // if(closest.length > 0){
        //         //   closestFar.push(closest);
        //         // }
        //         if(closest.length >0){
        //           //get only closest instance
        //           let distance = 10000;
        //           for(let c of closest ){
        //             let distanceInner = Math.sqrt(Math.pow(polygon.site.x - c.site.x,2)+Math.pow(polygon.site.y - c.site.y,2));
        //             if(distanceInner < distance){
        //               distance = distanceInner;
        //               closestFar = c;
        //             }
        //           }
        //           //distance is relative to the weight of the site
        //
        //         }
        //       }
        //       //console.log(closestFar.site.originalObject.data.originalData.id + " is Closest ")
        //       let energyDistance = scale(polygon.site.originalObject.data.originalData.length);
        //
        //       //calculate vector
        //       let values = new Array();
        //       values.push([closestFar.site.x, closestFar.site.y]);
        //       values.push([polygon.site.centroid[0], polygon.site.centroid[1]]);
        //
        //       let posX = (centroid[0] - mapPoint.x);
        //       let posY = (centroid[1] - mapPoint.y);
        //
        //       if(closestFar != undefined && closestFar.length > 1) {
        //
        //         let betweenVec = new vec2(values[0][0] - values[1][0], values[0][1] - values[1][1]);
        //         betweenVec.normalize();
        //         let distanceInner = Math.sqrt(Math.pow(values[0][0] - values[1][0],2)+Math.pow(values[0][1] - values[1][1],2));
        //         let betweenVecPerp = new vec2(betweenVec.y, -betweenVec.x);
        //         betweenVecPerp.normalize();
        //         let altX = (polygon.site.x - ((20 * energyDistance) * betweenVec.x));
        //         let altY = (polygon.site.x - ((20 * energyDistance) * betweenVec.y));
        //
        //         let altXPerp = polygon.site.x - ((distanceInner/4)  * betweenVec.x);
        //         let altYPerp = polygon.site.y - ((distanceInner/4)  * betweenVec.y);
        //
        //         // mapPoint.x = altXPerp;
        //         // mapPoint.y = altYPerp;
        //
        //         // closestFar.site.x = altXPerp;
        //         // closestFar.site.y = altXPerp;
        //
        //         dx = centroid[0] - altXPerp;
        //         dy = centroid[1] - altYPerp;
        //
        //         // for(let c of closestFar){
        //         //   let betweenVecSource = new vec2(values[0][0] -  mapPoint.x, values[0][1] - mapPoint.y);
        //         //   betweenVecSource.normalize();
        //         //   let altXPerpSource = values[0][0]  - ((distanceInner/4)  * betweenVecSource.x);
        //         //   let altYPerpSource = values[0][1]  - ((distanceInner/4)  * betweenVecSource.y);
        //         // //
        //         // closestFar.site.x = altXPerpSource;
        //         // closestFar.site.y = altYPerpSource;
        //         // }
        //
        //       } else {
        //         dx = centroid[0] - mapPoint.x;
        //         dy = centroid[1] - mapPoint.y;
        //       }
        //
        //     } else {
        //       dx = centroid[0] - mapPoint.x;
        //       dy = centroid[1] - mapPoint.y;
        //     }
        //
        //
        //     // dx = centroid[0] - mapPoint.x;
        //     // dy = centroid[1] - mapPoint.y;
        //
        //     // let edgelengthsTooSmall = polygon.reduce((acc, cur) => {
        //     //   if (Math.abs(cur[0] - cur[1]) < 5 || acc === true) {
        //     //     return true;
        //     //   } else {
        //     //     return false;
        //     //   }
        //     // },false);
        //     //
        //     // let innerDegree = polygon.reduce((acc, cur, index) => {
        //     //   if(index < polygon.length-1){
        //     //     let x = polygon[index][0]*polygon[index+1][0]+polygon[index][1]*polygon[index+1][1];
        //     //     let y = polygon[index][0]*polygon[index+1][1]-polygon[index+1][0]*polygon[index][1];
        //     //     acc.push(Math.PI + Math.atan2(y, x) * (180/Math.PI));
        //     //   } else {
        //     //     let x = polygon[index][0]*polygon[0][0]+polygon[index][1]*polygon[0][1];
        //     //     let y = polygon[index][0]*polygon[0][1]-polygon[0][0]*polygon[index][1];
        //     //     acc.push(Math.PI + Math.atan2(y, x) * (180/Math.PI));
        //     //   }
        //     //   return acc;
        //     //   //return Math.Pi + Math.atan2(math.cross(polygon[index], polygon[index+1]), math.dot(polygon[index], polygon[index+1]))
        //     // }, []);
        //     //
        //     // let radiusTooSmall = innerDegree.reduce((acc, cur) => {
        //     //   if (Math.abs(cur) < 2 || acc === true) {
        //     //     return true;
        //     //   } else {
        //     //     return false;
        //     //   }
        //     // },false);
        //
        //     // if(edgelengthsTooSmall || radiusTooSmall){
        //     //   dx = 0;
        //     //   dy = 0;
        //     // }
        //
        //     //begin: handle excessive change;
        //     dx *= d;
        //     dy *= d;
        //     mapPoint.x += dx;
        //     mapPoint.y += dy;
        //
        //     // mapPoint.x = Math.min(Math.max(mapPoint.x, 500), 1000);
        //     // mapPoint.y = Math.min(Math.max(mapPoint.y, 500), 1000);
        //     newMapPoints.push(mapPoint);
        //   }
        //
        //   handleOverweighted(newMapPoints);
        // }

        function moveTowardsAttraction(polygon, attractionArray, sourceMatch, mapPoint, centroid, targetPolygon, diff, edgeLength, invert) {
            //We have to recalculate the vectors here every time
            //THe amout it moves should depend on the distance it has to go
            let dx = attractionArray[sourceMatch].vecSourceTarget[0]
            let dy = attractionArray[sourceMatch].vecSourceTarget[1]

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
            if (betweenVecNormalize[0] !== attractionArray[sourceMatch].vecSourceTarget[0] && betweenVecNormalize[1] !== attractionArray[sourceMatch].vecSourceTarget[1]) {
                console.log("error, vector has flipped")
            }
            // distFactor is dependent on the distance between the nodes of the constraint
            //should move half of the distance in one step
            // var x = d3.scaleLinear()
            //     .domain([0, attractionArray[sourceMatch].distAB])
            //     .range([0, 1]);
            let distFactor = len * 0.2
            // let altX = (centroid[0] - (distFactor * betweenVecNormalize[0]));
            // let altY = (centroid[1] - (distFactor * betweenVecNormalize[1]));

            // dx = altX - mapPoint.x ;
            // dy = altY - mapPoint.y ;
            let mpCopy = [mapPoint.x, mapPoint.y]
            let newPosX = mapPoint.x + diff * (10 * betweenVecNormalize[0]);//dx;
            newPosX += diff * (2 * betweenVecNormalize[1])
            let newPosY = mapPoint.y + diff * (10 * betweenVecNormalize[1]);//dx;
            newPosY += diff * (2 * (-betweenVecNormalize[0]))
            let isInsidePoly = d3Polygon.polygonContains(clippingPolygon, [newPosX, newPosY])
            if (!isInsidePoly && len > edgeLength) {
                console.log("error, not inside polygon")
            } else {
                mapPoint.x = newPosX
                mapPoint.y = newPosY
                // mapPoint.x += diff*(10 * betweenVecNormalize[0]);//dx;
                // mapPoint.y += diff*(10 * betweenVecNormalize[1]);//dy;
                // mapPoint.x += diff*(5 * betweenVecNormalize[1])//dx;
                // mapPoint.y += diff*(5 * (-betweenVecNormalize[0]))//dy;
                polygon.site.x = mapPoint.x
                polygon.site.y = mapPoint.y
            }

            // mapPoint.x += (25 * betweenVecNormalize[0]);//dx;
            // mapPoint.y += (25 * betweenVecNormalize[1]);//dy;
            // polygon.site.x = mapPoint.x
            // polygon.site.y = mapPoint.y

            //Check that distance gets smaller
            var distAB_new = Math.sqrt(Math.pow((targetPosition[0] - mapPoint.x), 2) + Math.pow((targetPosition[1] - mapPoint.y), 2));
            // let distAB_new = Math.sqrt((mapPoint.x * targetPosition[0]) + (mapPoint.y*targetPosition[1]));
            if (len < distAB_new) {
                console.log("error, distance not getting smaller")
            }
        }

        function moveTowardsFix(polygon, mapPoint, diff, centroid, attractionArray, sourceMatch) {
            let dx = centroid[0] - mapPoint.x;
            let dy = centroid[1] - mapPoint.y;
            let dx_constraint = attractionArray[sourceMatch].vecSourceTarget[0]
            let dy_constraint = attractionArray[sourceMatch].vecSourceTarget[1]
            let betweenVec = [attractionArray[sourceMatch].sourcePos[0] - attractionArray[sourceMatch].targetPos[0], attractionArray[sourceMatch].sourcePos[1] - attractionArray[sourceMatch].targetPos[1]];
            let len = Math.sqrt((betweenVec[0] * betweenVec[0]) + (betweenVec[1] * betweenVec[1]));
            let betweenVecNormalize = [betweenVec[0] / len, betweenVec[1] / len];


            // let altX = (polygon.site.x - (15 * betweenVecNormalize[1]));
            // let altY = (polygon.site.y - (15 * (-betweenVecNormalize[0])));
            //
            // dx_constraint = altX - mapPoint.x ;
            // dy_constraint = altY - mapPoint.y ;

            //begin: handle excessive change;
            dx *= diff;
            dy *= diff;
            //end: handle excessive change;

            mapPoint.x += (5 * betweenVecNormalize[1])//dx;
            mapPoint.y += (5 * (-betweenVecNormalize[0]))//dy;
            polygon.site.x = mapPoint.x
            polygon.site.y = mapPoint.y


            let angleDeg = Math.atan2((mapPoint.y + dy) - (mapPoint.y + dy_constraint), (mapPoint.x + dx) - (mapPoint.y + dx_constraint)) * 180 / Math.PI;
            // if (angleDeg < 90 && angleDeg > -90){
            //   mapPoint.x += dx;
            //   mapPoint.y += dy;
            //   polygon.site.x = mapPoint.x
            //   polygon.site.y = mapPoint.y
            // } else {
            //
            // }
            // if (dx < 0 && dy < 0 && dx_constraint > 0 && dy_constraint > 0){
            //
            // } else if (dx > 0 && dy > 0 && dx_constraint < 0 && dy_constraint < 0){
            //
            // } else {
            //   mapPoint.x += dx;
            //   mapPoint.y += dy;
            //   polygon.site.x = mapPoint.x
            //   polygon.site.y = mapPoint.y
            // }

            // mapPoint.x += dx;
            // mapPoint.y += dy;
            // polygon.site.x = mapPoint.x
            // polygon.site.y = mapPoint.y
        }

        function moveTowards(polygon, mapPoint, diff, centroid) {
            let dx = centroid[0] - mapPoint.x;
            let dy = centroid[1] - mapPoint.y;

            //begin: handle excessive change;
            dx *= diff;
            dy *= diff;
            //end: handle excessive change;

            mapPoint.x += dx;
            mapPoint.y += dy;
            polygon.site.x = mapPoint.x
            polygon.site.y = mapPoint.y
        }

        function adaptPositions(polygons, flickeringMitigationRatio, attractionArray) {
            var newMapPoints = [],
                flickeringInfluence = 0.5;
            var flickeringMitigation, diff, polygon, mapPoint, centroid, dx, dy;

            flickeringMitigation = flickeringInfluence * flickeringMitigationRatio;
            diff = 1 - flickeringMitigation; // in [0.5, 1]
            let sourceMatch = -1;
            let targetMatch = -1;
            //Sort sites by their max distance constraint /
            //sites with constraints that have long distances should be moved last
            let indicesSorted = Array.from(Array(siteCount).keys())
            if (attractionArray.length > 0) {
                let sortedPolygonIndices = polygons.map(d => {
                    let constraintsCurrent = attractionArray.filter(e => e.sourceID === d.site.originalObject.data.originalData.data.id)
                    //Get max Distance for the constraints
                    if (constraintsCurrent.length > 0) {
                        d.site.maxDist = constraintsCurrent.sort((a, b) => a.distAB - b.distAB)[0].distAB;
                    } else {
                        d.site.maxDist = 0;
                    }

                });
                //Not enougth, also have to order based on existing constraints or not.
                indicesSorted = Array.from(Array(polygons.length).keys())
                    .sort((a, b) => polygons[a].site.maxDist < polygons[b].site.maxDist ? -1 : (polygons[b].site.maxDist < polygons[a].site.maxDist) | 0)
            }

            for (let i = 0; i < siteCount; i++) {
                let currIdx = indicesSorted[i]
                polygon = polygons[currIdx];
                mapPoint = polygon.site.originalObject;
                centroid = d3Polygon.polygonCentroid(polygon);

                let currID = polygon.site.originalObject.data.originalData.data.id

                if (attractionArray.length > 0) {
                    sourceMatch = attractionArray.findIndex(d => d.sourceID === currID)
                    targetMatch = attractionArray.findIndex(d => d.targetID === currID)
                }
                let constraintsCurrent = attractionArray.filter(d => d.sourceID === currID)
                //loop over sim constraints
                if (!constraintsFullfilled.hasOwnProperty(currID) || (constraintsFullfilled.hasOwnProperty(currID) && constraintsCurrent.length !== constraintsFullfilled[currID].length)) {
                    constraintsFullfilled[currID] = new Array(constraintsCurrent.length).fill(false);
                }
                let constrainsFinished = constraintsFullfilled[currID].every(d => d.isFullfilled === true)
                // if (!constrainsFinished){
                //   //Still have to continue optimizing the constrains
                // }
                if (constraintsCurrent.length > 0) {//
                    //Check if any of the constraints are not satisfied
                    for (let j = 0; j < constraintsCurrent.length; j++) {
                        // constrainsFinished = constraintsCurrent.every(d => d.isFulfilled === true)
                        //For each constraint
                        let invert = false;
                        let currConstraint = constraintsCurrent[j];
                        let targetPolygon = polygons.find(d => d.site.originalObject.data.originalData.data.id === currConstraint.targetID)
                        let attrIndex = attractionArray.findIndex(d => d.sourceID === currID && d.targetID === currConstraint.targetID)
                        // if (currConstraint.isFulfilled){
                        //   moveTowards(polygon, mapPoint, diff, centroid)
                        // } else {
                        //connect node with point of constraint
                        //get current neighbours
                        let currNeighbours = polygon.site.originalObject.connectivity
                        // for (let k = 0; k < currNeighbours.length; k++) {
                        //Check if neighbour also has constraint to the current constraint
                        //For each neighbour
                        //Either neighbor is the node with the constraint, or the neighbouring node is not the constraint node but also is constrained to be near it
                        let currConstraintIDx = currNeighbours.findIndex(d => d.id === currConstraint.targetID)
                        let edgeLength = 0
                        if (currConstraintIDx !== -1) {
                            let leftidx = currConstraintIDx === 0 ? currNeighbours.length - 1 : currConstraintIDx - 1
                            let left = polygon[leftidx]
                            let right = polygon[(currConstraintIDx) % currNeighbours.length]
                            edgeLength = Math.sqrt(Math.pow((left[0] - right[0]), 2) + Math.pow((left[1] - right[1]), 2));
                            // edgeLength = Math.sqrt((left[0] * right[0]) + (left[1]*right[1]));
                            console.log(edgeLength)
                        }
                        if (edgeLength < 100 && edgeLength > 0) {
                            console.log("small edge between" + currID + " and " + currConstraint.targetID + "")
                        }
                        let constraintIsNeighbourSameParent = currNeighbours.filter(d => d.id === currConstraint.targetID)//only for same neighbours
                        let constraintIsNeighbourOtherParent = currNeighbours.filter(d => d.id === -1 && d.hasOwnProperty("parentDataID") && d.parentDataID === currConstraint.targetParent.originalObject.data.originalData.data.id)
                        // let left = polygon.site.edgeList[(currConstraintIDx) % polygon.site.edgeList.length]
                        // let right = polygon.site.edgeList[(currConstraintIDx+1) % polygon.site.edgeList.length]
                        // let edgeLength = Math.sqrt((left[0] * right[0]) + (left[1]*right[1]));
                        //$dict[root.data.id].site.propertiesNeighboursClipped[currN.parent]
                        if (constraintIsNeighbourSameParent.length > 0) { //((constraintIsNeighbourSameParent.length > 0 && edgeLength < 250) || (constraintIsNeighbourSameParent.length > 0 && edgeLength > 300)){
                            //Neighbour is constraint, stop
                            //If the node has all the constraints fullfilled, we move once towards centroid
                            //Otherwise, we
                            constraintsFullfilled[currID][j] = true
                            currConstraint.isFullfilled = true

                            let overallCurrEdgeLength = d3Polygon.polygonLength(targetPolygon);
                            let targetConstraints = attractionArray.filter(d => d.sourceID === targetPolygon.site.originalObject.data.originalData.data.id);
                            let optEdgeLength = overallCurrEdgeLength / targetConstraints.length;
                            //Multiply Edge by ratio of all areas of constraints
                            //Get all
                            if (targetConstraints.length > 1) {
                                let targetPolygons = targetConstraints.map(e => polygons.filter(d => d.site.originalObject.data.originalData.data.id === e.targetID)[0])
                                let overallArea = targetPolygons.reduce((acc, cur) => cur.site.originalObject.data.originalData.data.weight + acc, 0);
                                // let specArea = 100*overallArea*/polygon.site.originalObject.data.originalData.data.weight
                                // let specArea = targetPolygons.map( e => 100/overallArea*e.site.originalObject.data.weight)
                                // console.log(specArea)
                                optEdgeLength = (overallCurrEdgeLength / overallArea) * polygon.site.originalObject.data.originalData.data.weight
                            }
                            let currentEdgeLength = edgeLength;
                            if (currentEdgeLength > optEdgeLength * 2) {
                                //Move away
                                invert = true;
                                console.log(currID + " should move away from " + currConstraint.targetID)
                                moveTowardsAttraction(polygon, attractionArray, attrIndex, mapPoint, centroid, targetPolygon, diff, edgeLength, invert)
                            } else if (constraintsFullfilled[currID].every(d => d === true) && currentEdgeLength > 100) {
                                console.log(currID + " is already a neighbour of constrained node " + currConstraint.targetID, " should only use centroid here")
                                moveTowards(polygon, mapPoint, diff, centroid, attractionArray, sourceMatch)
                                break;
                            }
                            // moveTowards(polygon, mapPoint, diff, centroid)
                            // moveTowardsFix(polygon, mapPoint, diff, centroid, attractionArray, sourceMatch)
                            //Only do move Towards if the movement does not change the attraction constraints
                            //should never be away from the constraint
                            //only if the length of the polygon edge is larger than ...
                        } else if (constraintIsNeighbourOtherParent.length > 0) {
                            console.log(currID + " is at the border of its cell and cannot move anymore towards " + currConstraint.targetID)
                            currConstraint.isFullfilled = true
                            constraintsFullfilled[currID][j] = true
                        } else {
                            currConstraint.isFullfilled = false
                            constraintsFullfilled[currID][j] = false
                            //get polygon that is constrain with updated position
                            console.log(currID + " should move towards " + currConstraint.targetID)
                            //Check how many cells are currently attached to the edges of the constrained node
                            //If there still is space, move towards the edge/cell
                            //target Polygon
                            // TODO Should only move towards constraints that are inside of a certain angle, especially of they are outer constraints, not inner constraints
                            // Sometimes causes flipping?
                            moveTowardsAttraction(polygon, attractionArray, attrIndex, mapPoint, centroid, targetPolygon, diff, edgeLength, invert)
                            // let constraintsNeighbour = currNeighbours.filter(d => attractionArray.some(e => e.sourceID === d.id && e.targetId ===currConstraint.targetID ) )
                            // // let constraintsNeighbour = attractionArray.some(d => d.targetID ===currConstraint.targetID && currNeighbours.some(e => e.id === d.sourceID))
                            // //Neighbour is not constraint, check if any of the neighbours has a constraint with the current Constraint as the target node
                            // // let constraintsNeighbour = attractionArray.filter(d => d.sourceID ===  currNeighbours[k].id && d.targetID ===currConstraint.targetID)
                            // if (constraintsNeighbour.length > 0){
                            //   console.log("Does not have to move")
                            //   moveTowards(polygon, mapPoint, diff, centroid)
                            // } else {
                            //   console.log(currID+" should move towards "+currConstraint.targetID)
                            //   moveTowardsAttraction(polygon, attractionArray, sourceMatch, mapPoint)
                            // }
                        }
                        // }
                        // }

                    }
                } else {
                    //no constraints on node, simply move
                    moveTowards(polygon, mapPoint, diff, centroid)
                }
                let oldMapPoint = polygon.site.originalObject;
                // console.log("moving")
                //intersect line with the edges of all
                //If yes, do not move
                //If no, move towards current constraint


                // if(sourceMatch !== -1){
                //   //dx and dy from attraction
                //   dx = attractionArray[sourceMatch].vecSourceTarget[0]
                //   dy = attractionArray[sourceMatch].vecSourceTarget[1]
                //
                //   let betweenVec = [attractionArray[sourceMatch].sourcePos[0] - attractionArray[sourceMatch].targetPos[0], attractionArray[sourceMatch].sourcePos[1] - attractionArray[sourceMatch].targetPos[1]];
                //   let len = Math.sqrt((betweenVec[0] * betweenVec[0]) + (betweenVec[1]*betweenVec[1]));
                //   let betweenVecNormalize = [betweenVec[0]/len, betweenVec[1]/len];
                //
                //
                //   let altX = (polygon.site.x - (35 * betweenVecNormalize[0]));
                //   let altY = (polygon.site.y - (35 * betweenVecNormalize[1]));
                //
                //   dx = altX - mapPoint.x ;
                //   dy = altY - mapPoint.y ;
                //
                //   mapPoint.x += dx;
                //   mapPoint.y += dy;
                // } else if (targetMatch !== -1){
                //   // dx = attractionArray[targetMatch].vecTargetSource[0]
                //   // dy = attractionArray[targetMatch].vecTargetSource[1]
                //   // // dx = centroid[0] - mapPoint.x;
                //   // // dy = centroid[1] - mapPoint.y;
                //   // // dx = centroid[0] - mapPoint.x;
                //   // // dy = centroid[1] - mapPoint.y;
                //   // d = 2
                //   // // targetPoint = [dx[0]*distance+polygon.site.x, dx[1]*eDistAtoB + polygon.site.y]
                //   // //begin: handle excessive change;
                //   // dx *= d;
                //   // dy *= d;
                //   // mapPoint.x += dx;
                //   // mapPoint.y += dy;
                //   dx = centroid[0] - mapPoint.x;
                //   dy = centroid[1] - mapPoint.y;
                //
                //   //begin: handle excessive change;
                //   dx *= diff;
                //   dy *= diff;
                //   //end: handle excessive change;
                //
                //   mapPoint.x -= dx;
                //   mapPoint.y -= dy;
                // } else {
                //   dx = centroid[0] - mapPoint.x;
                //   dy = centroid[1] - mapPoint.y;
                //
                //   //begin: handle excessive change;
                //   dx *= diff;
                //   dy *= diff;
                //   //end: handle excessive change;
                //
                //   mapPoint.x += dx;
                //   mapPoint.y += dy;
                //   polygon.site.x = mapPoint.x
                //   polygon.site.y = mapPoint.y
                // }


                newMapPoints.push(mapPoint);
            }

            handleOverweighted(newMapPoints);
        }

        function adaptWeights(polygons, flickeringMitigationRatio) {
            var newMapPoints = [],
                flickeringInfluence = 0.1;
            var flickeringMitigation, polygon, mapPoint, currentArea, adaptRatio, adaptedWeight;

            flickeringMitigation = flickeringInfluence * flickeringMitigationRatio;
            for (var i = 0; i < siteCount; i++) {
                polygon = polygons[i];
                mapPoint = polygon.site.originalObject;
                currentArea = d3Polygon.polygonArea(polygon);
                adaptRatio = mapPoint.targetedArea / currentArea;

                //begin: handle excessive change;
                adaptRatio = Math.max(adaptRatio, 1 - flickeringInfluence + flickeringMitigation); // in [(1-flickeringInfluence), 1]
                adaptRatio = Math.min(adaptRatio, 1 + flickeringInfluence - flickeringMitigation); // in [1, (1+flickeringInfluence)]
                //end: handle excessive change;

                adaptedWeight = mapPoint.weight * adaptRatio;
                adaptedWeight = Math.max(adaptedWeight, epsilon);

                mapPoint.weight = adaptedWeight;

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
                    throw new d3VoronoiMapError('handleOverweighted0 is looping too much');
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
                            // adaptedWeight = sqrD - epsilon; // as in ArlindNocaj/Voronoi-Treemap-Library
                            // adaptedWeight = sqrD + lightest.weight - epsilon; // works, but below heuristics performs better (less flickering)
                            adaptedWeight = sqrD + lightest.weight / 2;
                            adaptedWeight = Math.max(adaptedWeight, epsilon);
                            weightest.weight = adaptedWeight;
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
                polygon = polygons[i];
                mapPoint = polygon.site.originalObject;
                currentArea = d3Polygon.polygonArea(polygon);
                areaErrorSum += Math.abs(mapPoint.targetedArea - currentArea);
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

        return simulation;
    }

    exports.voronoiMapSimulation = voronoiMapSimulation;
    exports.voronoiMapInitialPositionRandom = randomInitialPosition;
    exports.voronoiMapInitialPositionPie = pie;
    exports.d3VoronoiMapError = d3VoronoiMapError;

    Object.defineProperty(exports, '__esModule', {value: true});

}));
