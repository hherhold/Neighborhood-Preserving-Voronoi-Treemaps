<script>

    import {
        attractionLinksPerRankNSteps,
        colorScale,
        constraintsHoverSet,
        dict,
        finalPolygons,
        hover_set,
        initializationStrategies,
        linkIntersectionsPerRankNSteps,
        matchingStore,
        maxIterations,
        myseededprng,
        selectedInitializationStrategyID,
        similarityStore,
        useCategoricalColors,
        voronoiCellsGroupedNSteps,
        voronoiEdges,
        voronoiEdgesAll,
        voronoiEdgesByRank,
        voronoiStoreIDOptimized,
        voronoiStoreOptimized,
    } from "../store";
    import {intersect, reformat, roundArray} from "../helpers/helpers"
    import {createEventDispatcher} from "svelte";
    import {voronoiMapSimulation as d3VoronoiMapSimulation} from 'd3-voronoi-map';
    import * as d3 from "d3";
    import {sqrt} from "mathjs";

    export let root = {};
    export let depth;
    export let uuid;
    export let isInitialized = false;
    export let currentStep = 0;
    export let simulation = -1;
    export let state = -1;
    export let forceBasedInitializationFinished;
    let currentStepAdjusted = 0;

    let medianSim = -1;
    const dispatch = createEventDispatcher();

    let weightScale = 124491;

    export function savePolygonSites() {
        if (root.hasOwnProperty('children')) {
            for (let j = 0; j < root.children.length; j++) {
                let currChild = root.children[j];
                let currPolygon = state.polygons.find(d => d.site.originalObject.data.originalData.data.id === currChild.data.id);
                if (currPolygon === undefined) {
                    console.log("error, cannot find polygon")
                    currPolygon = currChild.data.initialPos
                    currPolygon.originalObject.data.originalData = currChild
                    currPolygon.id = currChild.data.id
                    $voronoiStoreIDOptimized[currChild.data.id] = currPolygon;
                } else {
                    currPolygon.site.id = currPolygon.site.originalObject.data.originalData.data.id
                    currPolygon.site
                    $voronoiStoreIDOptimized[currChild.data.id] = currPolygon.site;
                }
            }
        } else {

        }
    }

    function hasEnded() {
        let sites = []
        let listEdges = []
        for (let j = 0; j < root.children.length; j++) {
            let currChild = root.children[j];
            let currPolygon = state.polygons.find(d => d.site.originalObject.data.originalData.data.id === currChild.data.id);
            if (currPolygon !== undefined) {
                currChild.clippingPolygon = currPolygon;
                currChild.site = currPolygon.site
                //Each point in the site is exactly one neighbour

                //Draw in similarities between neighbours
                //check if points lie on outline
                if ($initializationStrategies[$selectedInitializationStrategyID].name === 'force') {
                    for (let k = 0; k < currPolygon.site.propertiesNeighboursClipped.length; k++) {
                        //Loop over all points of the polygon
                        let currN = currPolygon.site.propertiesNeighboursClipped[k];
                        let prevIdx = k > 0 ? k - 1 : currPolygon.length - 1;
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
                                            line: roundArray([left, right])
                                        }
                                    );
                                }
                            }
                        } else {
                            if (depth === 0) {
                                //on depth 0 the similarity is always 0
                                listEdges.push(
                                    {
                                        source: currChild.data.id,
                                        target: currN.id,
                                        line: roundArray([left, right])
                                    }
                                );
                            } else {
                                let parentN = $dict[root.data.id].site.propertiesNeighboursClipped[currN.parent];
                                if (parentN === undefined) {
                                    console.log("error")
                                }
                                listEdges.push(
                                    {
                                        source: currChild.data.id,
                                        target: parentN.id,
                                        line: roundArray([left, right])
                                    }
                                );

                            }

                        }
                    }
                }
            }
            sites.push(currPolygon)
            if (currPolygon === undefined || (!currPolygon.hasOwnProperty('site'))) {
                console.log("cannot find site")
            } else {
                $voronoiStoreIDOptimized[currChild.data.id] = currPolygon.site;
                finalPolygons.set([...$finalPolygons, currPolygon.site])
            }
            $finalPolygons = $finalPolygons
        }
        //Save state
        root.state = state
        $voronoiEdges[root.data.id] = listEdges
        $voronoiStoreOptimized[root.data.id] = sites

        //insert similarity
        if (listEdges.length > 0) {
            $voronoiEdgesAll.push(...listEdges)
            //Overwrite the positions
            //Add edges for rank
            if ($voronoiEdgesByRank.hasOwnProperty(depth)) {
                if (!Array.isArray($voronoiEdgesByRank[depth])) {
                    console.log("error")
                }
                if (!(listEdges.length > 0)) {
                    console.log("error")
                }
                $voronoiEdgesByRank[depth].push(...listEdges)
            } else {
                if (!Array.isArray(listEdges)) {
                    console.log("error")
                } else {
                    $voronoiEdgesByRank[depth] = listEdges;
                }
            }
        }
        root.voronoiPositions = sites;
    }

    function update() {
        if (state.ended) {
            hasEnded();
            dispatch('computationFinished', {
                id: uuid
            });
            console.log("Voronoi Optimization Finished")
        }
    }

    function updateEdgesWithParents(currPolygon) {
        for (let k = 0; k < currPolygon.site.propertiesNeighboursClipped.length; k++) {
            //Loop over all points of the polygon
            let currN = currPolygon.site.propertiesNeighboursClipped[k];
            if (currN.id !== -1) { //is boundary vertex
            } else {
                if (depth === 0) {
                    //on depth 0 the similarity is always 0
                } else {
                    let parentN = $dict[root.data.id].site.propertiesNeighboursClipped[currN.parent];
                    currPolygon.site.propertiesNeighboursClipped[k].parentDataID = parentN.id
                }
            }
        }
    }

    async function swapOnNeighborhood() {
        let swapped = false;
        //own state is in state
        //all other polygons are in $voronoiStoreIDOptimized[id]
        // All cells grouped by rank
        //Filter alll the nodes based on depth+1, as we want to compare child polygons with each other
        const polygons_on_depth = {}
        const neighbor_dict = {}
        for (const [key, value] of Object.entries($voronoiStoreIDOptimized)) {
            if ("originalObject" in value && value.originalObject.data.originalData.depth === depth + 1) {
                polygons_on_depth[key] = value

            }
        }

        for (const [key, value] of Object.entries(polygons_on_depth)) {
            const adjacientPolygons = getAdjacent(value, Object.values(polygons_on_depth))
            neighbor_dict[key] = new Set([...adjacientPolygons].map(d => d.originalObject.data.originalData.data.id))
        }

        const possible_swaps = []

        for (let a = 0; a < Object.keys(polygons_on_depth).length; a++) {
            const keyA = Object.keys(polygons_on_depth)[a]
            const polygonA = polygons_on_depth[keyA]
            const polygons_same_parent = {}

            for (const [key, value] of Object.entries($voronoiStoreIDOptimized)) {
                if ("originalObject" in value && value.originalObject.data.originalData.parent.data.id === polygonA.originalObject.data.originalData.parent.data.id) {
                    polygons_same_parent[key] = value
                }
            }

            const adjacentToAPolygons = neighbor_dict[keyA]
            const ExpectedLinkIDsA = new Set(polygonA.originalObject.data.originalData.data.similarities.constraintsFromChildren.map(d => d[0]))
            let PolygonAcorrectNeighors = ExpectedLinkIDsA.intersection(adjacentToAPolygons)

            for (let b = 0; b < Object.keys(polygons_same_parent).length; b++) {
                const keyB = Object.keys(polygons_on_depth)[b]
                const polygonB = polygons_on_depth[keyB]
                const adjacentToBPolygons = neighbor_dict[keyB]
                const ExpectedLinkIDsB = new Set(polygonB.originalObject.data.originalData.data.similarities.constraintsFromChildren.map(d => d[0]))
                let PolygonBcorrectNeighors = ExpectedLinkIDsB.intersection(ExpectedLinkIDsB)
                let total_correct = PolygonAcorrectNeighors.size + PolygonBcorrectNeighors.size

                let total_correct_after_swap = ExpectedLinkIDsA.intersection(adjacentToBPolygons).size + ExpectedLinkIDsB.intersection(ExpectedLinkIDsA).size
                if (total_correct_after_swap > total_correct) {
                    console.log(`${keyA} - ${keyB} total correct without swap: ${total_correct} total correct with swap: ${total_correct_after_swap}`)
                    possible_swaps.push({"idA": keyA, "idB": keyB, "value": total_correct_after_swap - total_correct})
                }

            }
        }
        possible_swaps.sort((a, b) => b.value - a.value)

        if (possible_swaps.length > 0) {
            const idA = possible_swaps[0].idA
            const idB = possible_swaps[0].idB
            const PolyA = polygons_on_depth[idA]
            const PolyB = polygons_on_depth[idB]
            console.log(`Swap ${idA} and ${idB}`)
            swap(PolyA, PolyB)
            polygons_on_depth[idA] = PolyB
            polygons_on_depth[idB] = PolyA

        }
        return {swapped: swapped, state: state}
    }

    function swap(nodeA, nodeB) {
        const tmp = nodeA.originalObject
        nodeA.originalObject = nodeB.originalObject
        nodeB.originalObject = tmp
    }

    function getAdjacent(current, others) {
        const return_list = new Set()
        for (const other of others) {
            for (const edge_other of getEdges(other.polygon)) {
                for (const edge_current of getEdges(current.polygon)) {
                    const [start_other, end_other] = edge_other
                    const [start_current, end_current] = edge_current
                    const intersects = intersect(...start_other, ...end_other, ...start_current, ...end_current)
                    if (intersects && other !== current) {
                        return_list.add(other)
                    }
                }
            }
        }
        return return_list
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

    async function resolveIntersectionLinks() {
        let swapped = false;
        //Check for intersections, and redo the similarity
        for (let i = 0; i < state.polygons.length; i++) {
            if (swapped === false) {
                let polygon = state.polygons[i]
                if (polygon.site.originalObject.data.originalData.data.hasOwnProperty("constraintsFromChildren")) {
                    let list_pairs = polygon.site.originalObject.data.originalData.data.constraintsFromChildren
                    for (let j = 0; j < list_pairs.length; j++) {
                        //Do the swapping here
                        let currStep = $linkIntersectionsPerRankNSteps[root.depth].length - 1
                        if (root.depth in $linkIntersectionsPerRankNSteps && $linkIntersectionsPerRankNSteps[root.depth].length > 0 && currStep > 1) {
                            // let matchingCrossing = intersectionsWholeRank[iterationCount-1].filter(intersection => intersection.segments.find(e=> e.fromName === currID))
                            let matchingCrossing = $linkIntersectionsPerRankNSteps[root.depth][currStep].reduce(function (filtered, intersection) {
                                let matchingIndex = intersection.segments.findIndex(e => e.fromName === polygon.site.originalObject.data.originalData.data.id)
                                if (matchingIndex === -1) {
                                    matchingIndex = intersection.segments.findIndex(e => e.toName === polygon.site.originalObject.data.originalData.data.id)
                                }
                                if (matchingIndex !== -1) {
                                    let someNewValue = {
                                        index: matchingIndex,
                                        crossingIndex: matchingIndex === 1 ? 0 : 1,
                                        intersection: intersection
                                    }
                                    filtered.push(someNewValue);
                                }
                                return filtered;
                            }, []);
                            if (matchingCrossing.length > 0) {
                                //If we have a crossing of the current constraint with another constraint, swap the position of the cells if they are in the same
                                //We get the other line segment, that is not the current constraint, and get its StartPoint, and swap with it
                                let crossingPolygon = state.polygons.find(d => d.site.originalObject.data.originalData.data.id === matchingCrossing[0].intersection.segments[matchingCrossing[0].crossingIndex].fromName);
                                if (crossingPolygon === undefined) {
                                    crossingPolygon = state.polygons.find(d => d.site.originalObject.data.originalData.data.id === matchingCrossing[0].intersection.segments[matchingCrossing[0].crossingIndex].toName)
                                }
                                if (crossingPolygon !== undefined) {
                                    let prevCrossingPolygonPositionX = crossingPolygon.site.x;
                                    let prevCrossingPolygonPositionY = crossingPolygon.site.y;
                                    let prevCrossingPolygonCentroid = crossingPolygon.site.centroid;
                                    let prevCurrPositionX = polygon.site.x;
                                    let prevCurrPositionY = polygon.site.y;
                                    let prevCurrCentroid = polygon.site.centroid;
                                    crossingPolygon.site.x = prevCurrPositionX;
                                    crossingPolygon.site.y = prevCurrPositionY;
                                    polygon.site.x = prevCrossingPolygonPositionX
                                    polygon.site.y = prevCrossingPolygonPositionY;

                                    polygon.site.centroid = prevCrossingPolygonCentroid;
                                    crossingPolygon.site.centroid = prevCurrCentroid;

                                    crossingPolygon.site.originalObject.x = prevCurrPositionX;
                                    crossingPolygon.site.originalObject.y = prevCurrPositionY;
                                    polygon.site.originalObject.x = prevCrossingPolygonPositionX
                                    polygon.site.originalObject.y = prevCrossingPolygonPositionY
                                    // resolvedCrossing = 1;
                                    swapped = true
                                    break;
                                } else {
                                    console.log("error")
                                }
                            }
                        }
                    }
                }
            }
        }
        savePolygonSites();
        return {swapped: swapped, state: state}
    }

    async function updateAttractionLinks() {
        let similarity = []
        let similarityDictionary = {}
        if (state.iterationCount > 0) {
            for (let i = 0; i < state.polygons.length; i++) {
                let polygon = state.polygons[i]
                if (polygon !== undefined && polygon.site.originalObject.data.originalData.data.hasOwnProperty("constraintsFromChildren")) {
                    let list_pairs = polygon.site.originalObject.data.originalData.data.constraintsFromChildren.filter(e => e[1] !== 0)

                    //We also need to add all other contraints from other nodes here
                    let symmetricConstrains = []
                    for (let key of Object.keys($similarityStore)) {
                        let ob = $similarityStore[key]
                        //&& ob.constraintsFromChildren[0][1] !== 0
                        if (!(list_pairs.some(d => d[0] === key)) && ob.constraintsFromChildren.length > 0 && ob.constraintsFromChildren[0][0] === polygon.site.originalObject.data.originalData.data.id && ob.constraintsFromChildren[0][1] !== 0) {
                            //Add constraint
                            symmetricConstrains.push([key, ob.constraintsFromChildren[0][1]])
                        }
                    }
                    list_pairs.push(...symmetricConstrains)
                    list_pairs = polygon.site.originalObject.data.originalData.data.constraintsFromChildren.filter(e => e[1] !== 0)
                    //if we have too many, we have to reduce
                    let filtered = list_pairs.filter(e => e[1] === 100)
                    let filtered2 = list_pairs.filter(e => e[1] !== 100).sort((a, b) => b[1] - a[1])
                    list_pairs = [...filtered, ...filtered2]

                    $similarityStore[polygon.site.originalObject.data.originalData.data.id].constraintsFromChildren = list_pairs
                    polygon.site.originalObject.data.originalData.data.constraintsFromChildren = list_pairs
                    let list_pos = []
                    for (let j = 0; j < list_pairs.length; j++) {
                        let pair = list_pairs[j]
                        let source_id = polygon.site.originalObject.data.originalData.data.id
                        if (pair !== -1 && $voronoiStoreIDOptimized.hasOwnProperty(pair[0])) {
                            let pairPos = $voronoiStoreIDOptimized[pair[0]]
                            let pairPOsArray = [pairPos.x, pairPos.y]
                            list_pos.push(pairPOsArray)
                            state.polygons[i].site.pairPos = pairPOsArray
                            state.polygons[i].site.list_pos = list_pos
                            //vec instead of points
                            let a = [state.polygons[i].site.x, state.polygons[i].site.y]
                            let b = pairPOsArray
                            let eDistAtoB = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2));
                            // // compute the direction vector d from a to b
                            let dirVecAB = [(b[0] - a[0]) / eDistAtoB, (b[1] - a[1]) / eDistAtoB];
                            let dirVecBA = [(a[0] - b[0]) / eDistAtoB, (a[1] - b[1]) / eDistAtoB];
                            //x = dx*t + ax, y = dy*t + ay

                            //Only add attraction
                            //Draw line between face and attraction face
                            //If we cross any faces that are not also attracted to the node,
                            //And these are neighbours to the current node, we add it as a constraint

                            //Create line between the two nodes
                            //Check if any of the lines in the voronoi Diagram intersect these
                            let attObj = {
                                sourceID: source_id,
                                sourcePos: a,
                                targetID: pair[0],
                                target: $dict[pair[0]],
                                targetPolygon: $voronoiStoreIDOptimized[pair[0]].polygon,
                                targetParent: $voronoiStoreIDOptimized[$dict[pair[0]].parent.data.id],
                                targetPos: pairPOsArray,
                                vecSourceTarget: dirVecAB,
                                vecTargetSource: dirVecBA,
                                distSourceTarget: eDistAtoB,
                                isFulfilled: false,
                                sim: pair[1],
                                bracket: pair[2]
                            }
                            let indexObject = similarity.findIndex(d => d.targetID === pair[0] && d.sourceID === source_id)
                            if (indexObject === -1) {
                                similarity.push(attObj);
                                //creates new array if no key in dict and pushes new constraint
                                similarityDictionary[source_id] ||= []
                                similarityDictionary[source_id].push(attObj);
                            } else {
                                similarity[indexObject].distSourceTarget = eDistAtoB;
                            }
                            //Also add inverse if it does not already exist
                            let indexObjectInverse = similarity.findIndex(d => d.sourceID === pair[0] && d.targetID === source_id)
                            if (indexObjectInverse === -1) {
                                let attObj =
                                    {
                                        sourceID: pair[0],
                                        sourcePos: b,
                                        targetID: source_id,
                                        target: $dict[source_id],
                                        targetPolygon: $voronoiStoreIDOptimized[source_id].polygon,
                                        targetParent: $voronoiStoreIDOptimized[$dict[source_id].parent.data.id],
                                        targetPos: a,
                                        vecSourceTarget: dirVecBA,
                                        vecTargetSource: dirVecAB,
                                        distSourceTarget: eDistAtoB,
                                        isFulfilled: false,
                                        sim: pair[1],
                                        bracket: pair[2]
                                    };
                                similarity.push(attObj)
                                similarityDictionary[pair[0]] ||= []
                                similarityDictionary[pair[0]].push(attObj);
                            } else {
                                similarity[indexObjectInverse].distSourceTarget = eDistAtoB;
                            }


                        }
                    }
                } else {
                    console.log("error")
                }
            }
        }
        savePolygonSites();
        simulation.attractionArray(similarity)
        simulation.attractionDictionary(similarityDictionary)
    }

    export async function voronoiMapSwap() {
        state = simulation.state();
        let resolved = {swapped: false, state: state};
        if (simulation !== -1 && !state.ended) {
            resolved = await swapOnNeighborhood()
        }
        return resolved
    }

    export async function voronoiMapStep() {
        state = simulation.state();
        if (simulation !== -1 && !state.ended) {
            savePolygonSites();
            await updateAttractionLinks();
            simulation.polygonsWholeRank($voronoiStoreIDOptimized)
            simulation.intersectionsWholeRank($linkIntersectionsPerRankNSteps[root.voronoiID])
            state = simulation.state();
            //save new projections
            simulation.step()
            state = simulation.state();
            savePolygonSites();
            if (state.ended) {
                hasEnded();
                dispatch('computationFinished', {
                    id: uuid
                });
                console.log("Voronoi Optimization Finished")
            }
            return state;
        } else {
            dispatch('computationFinished', {
                id: uuid
            });
            console.log("No children, just use parent as state")
            return []
        }
    }

    function precomputedInitialPosition(d, i, arr, simulation) {
        if (depth === 0) {
            if ($initializationStrategies[$selectedInitializationStrategyID].name === 'projectionMapping') {
                return [d.data.initialPos.scaledX, d.data.initialPos.scaledY];
            } else {
                return [d.data.initialPos.x, d.data.initialPos.y];
            }
        } else {
            // console.log(d.data.id)
            if (d.data.initialPos !== undefined && root.children.length > 2) {
                return [d.data.initialPos.x, d.data.initialPos.y];
            } else if (d.data.initialPos !== undefined) {
                return [d.data.initialPos.x, d.data.initialPos.y];
            } else {
                return [0, 0];
            }
        }
    }

    function precomputedInitialWeight(d, i, arr, simulation) {
        return d.data.initialPos.weight;
    }

    $:if (
        !$voronoiStoreOptimized.hasOwnProperty(root.data.id)
        && $matchingStore.hasOwnProperty(root.depth + 1)
        && !isInitialized
        && forceBasedInitializationFinished
    ) {
        if (!root.hasOwnProperty('children')) {
            console.log("no children, just continue")
            dispatch('initializationFinished', {
                id: uuid
            });
            dispatch('computationFinished', {
                id: uuid
            });
            state = root.state
        } else {
            isInitialized = true;
            medianSim = -1;
            const parentColor = root.data.color
            let colorScaleParent = $colorScale
            if(parentColor === undefined){

            }
            else if (root.height === 1) {
                let darkerColor = d3.color(parentColor).darker(4)
                let lighterColor = d3.color(parentColor).brighter(0.5)
                colorScaleParent = d3.quantize(d3.interpolateHcl(lighterColor, parentColor, darkerColor), root.children.length + 2)
            } else if (root.depth !== 0) {
                let darkerColor = d3.hsl(parentColor)
                let lighterColor = d3.hsl(parentColor)
                colorScaleParent = d3.quantize(d3.interpolateHcl(lighterColor, parentColor, darkerColor), root.children.length + 2)
            }
            if(!root.hasOwnProperty('clippingPolygon')){
                root.clippingPolygon = root.parent.clippingPolygon
            }

            root.children.map((d, i) => {
                //Set the colors of all children
                if (root.depth === 0) {
                    //If on the highest rank, we use new categorical colors
                    //Otherwise, we use the color of the parent and offset it
                        if (!d.data.hasOwnProperty('color')) {
                            d.data.color = colorScaleParent(d.voronoiID);
                        }
                    } else {
                        d.data.color = colorScaleParent[i];
                    }
                    if (d.value === 0) {
                        d.value = 1
                    }
                    d.data.similarities = $similarityStore[d.data.id]
                })
                root.children.sort((a, b) => a.voronoiID - b.voronoiID);

                //First simulate with equal weights
                simulation = d3VoronoiMapSimulation(root.children)
                    .weight(function (d) {
                        return d.value
                    })        // set the weight accessor
                    .clip(root.clippingPolygon)  // set the clipping polygon
                    .currentInitializationStrategy($initializationStrategies[$selectedInitializationStrategyID].name)
                    .initialPosition(precomputedInitialPosition)
                    .initialWeight(precomputedInitialWeight)
                    .similarityStore($similarityStore)
                    .minWeightRatio(0.02)
                    .maxIterationCount($maxIterations)
                    .prng(myseededprng)
                    .convergenceRatio(0.01)
                    // .prng(prng_alea('number1'))
                    .on("tick", function () {
                        // function called after each iteration of computation
                        // called only in simulation mode, not in static mode
                        try {
                            update();
                        } catch (error) {
                            console.log("Error")
                        }
                    })
                    .similarity(true)
                    .stop();
                state = simulation.state();
                savePolygonSites()
                // retrieve the simulation's state, i.e. {ended, polygons, iterationCount, convergenceRatio}
                dispatch('initializationFinished', {
                    id: uuid
                });
            }

            $voronoiEdgesByRank[0] = []
            console.log("Voronoi Initialization Finished")

    }

    let squareSize = 300,	//distance between each point in the background
        hSquareCount = Math.floor(1080 / squareSize);

    function x(i) {
        return squareSize * i + squareSize / 2;
    }

    function y(j) {
        return x(j);
    }

    function invX(x) {
        return (x - squareSize / 2) / squareSize;
    }

    // function invY(y) {
    //     return invX(y);
    // }

    function uc(i) {
        return x(i) - squareSize / 2;
    }

    function unitCircle(polygon) {
        let unitRadius = sqrt(polygon.site.weight) //uc(sqrt(polygon.site.weight/weightScale));
        return (polygon.site.weight >= -1) ? unitRadius : 0
    }

    let ishover = false

    function handleMouseOver(e, d) {
        ishover = true
        if ('constraintsFromChildren' in d.site) {
            if (d.site.constraintsFromChildren.length > 0) {
                $constraintsHoverSet = d.site.constraintsFromChildren.map(e => e[0])
            } else {
                $constraintsHoverSet = []
            }
        }
        if (d.site.directNeighborsAll) {
            $hover_set = [...d.site.directNeighborsAll]
        }
    }

    function handleMouseOut(e) {
        ishover = false
        $hover_set = []
        $constraintsHoverSet = []
    }

    $: if (currentStep) {
        currentStepAdjusted = currentStep > $voronoiCellsGroupedNSteps[root.data.id].length ? $voronoiCellsGroupedNSteps[root.data.id].length - 1 : currentStep
        if (currentStep > $voronoiCellsGroupedNSteps[root.data.id].length) {
            $voronoiCellsGroupedNSteps[root.data.id][currentStepAdjusted]
        } else {

        }
    }

    function fillPolygon(polygon) {
        if ($useCategoricalColors) {
            return polygon.site.originalObject.data.originalData.data.color || 'none';
        } else {
            return polygon.site.originalObject.data.originalData.data.color || 'none';
        }
    }

    function shouldDrawTabs(polygons) {
        let sim = $similarityStore[polygons[0].id].sortedListWholeRank.find((element) => element[0] === polygons[1].id)[1]
        return [$attractionLinksPerRankNSteps[polygons[0].originalObject.data.originalData.depth - 1][0].some(d =>
            (d.sourceID === polygons[0].id && d.targetID === polygons[1].id)
            || (d.sourceID === polygons[1].id && d.targetID === polygons[0].id))
            , sim]
    }


</script>
{#if $matchingStore.hasOwnProperty(root.depth + 1)
}
    <g transform="translate(0,0)">
        {#if root.data.id in $voronoiCellsGroupedNSteps && $voronoiCellsGroupedNSteps[root.data.id].length > 0}
            {#if ['state'] in $voronoiCellsGroupedNSteps[root.data.id][currentStepAdjusted]
            && $voronoiCellsGroupedNSteps[root.data.id][currentStepAdjusted]['state'].length > 0}
                {@const puzzleEdges = reformat($voronoiCellsGroupedNSteps[root.data.id][currentStepAdjusted]['state'])}
                {#each $voronoiCellsGroupedNSteps[root.data.id][currentStepAdjusted]['state'] as polygon}
                    <path d="{d3.line()(polygon) + 'z'}" stroke="rgb(0, 0, 0)" stroke-width="1px"
                          fill="{polygon.site.color}"
                          class="voronoiCell
                                    {$hover_set.length > 0 && !$hover_set.includes(polygon.site.id) ? 'inactive' : ''}
                                    {!$constraintsHoverSet.includes(polygon.site.id) ? 'constraintNoOutline' : 'constraintOutline'}"
                          on:mouseover={(e) => handleMouseOver(e,polygon)} on:mouseout={handleMouseOut}
                          pointer-events="all"/>
                                        <g transform="translate({polygon.site.centroid[0]-5},{polygon.site.centroid[1]+5})"
                                           pointer-events="none">
                                            <text background-color="white"
                                                  stroke="rgb(0, 0, 0)">{polygon.site.id}</text>
                                        </g>
                {/each}
            {/if}
        {/if}
    </g>
{/if}

<style>
    :global(.inactive) {
        fill: gray !important;
    }
    .active {
        fill: red !important;
    }
</style>
