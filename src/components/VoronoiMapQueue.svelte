<svelte:options accessors/>

<script>
    import * as d3 from "d3";
    import * as d3plus from "d3plus-shape";
    import RangeSlider from "svelte-range-slider-pips";
    import VoronoiMapKnarfOptimized from "./VoronoiMapKnarfOptimized.svelte";
    import {onMount} from "svelte";
    import {
        attractionLinksPercentage,
        attractionLinksPerRankNSteps,
        attractionLinksPreservedTotal,
        attractionLinksTotal,
        averageConverganceRate,
        dict,
        doubleSidedAttractionLinks,
        hover_set,
        initializationStrategies,
        linkIntersectionsPerRankNSteps,
        matchingStore,
        maxIterations,
        maxSwaps,
        offsetStroke,
        pairLinks,
        projectionStore,
        queueGroupFinished,
        selectedInitializationStrategyID,
        showSimilarityConstraints,
        showVectors,
        similarityStore,
        stepsSoFar,
        voronoiCellsGroupedNSteps,
        voronoiEdgesByRank,
        voronoiStoreID,
        voronoiStoreIDOptimized
    } from "../store";
    import {intersect4, reformat, shortenEdge} from "../helpers/helpers.js";
    import cytoscape from 'cytoscape';
    import List, {Item, Text} from '@smui/list';
    import {max, mean, median} from "mathjs";
    import DataTable, {Body, Cell, Head, Row} from '@smui/data-table';
    import {segment} from '@flatten-js/core';
    import VoronoiMapForceInitialization from "./VoronoiMapForceInitialization.svelte";

    export let i;
    export let voronoiParents;
    export let nodes;
    export let width;
    export let height;
    export let cols = 5;

    const childMaps = [];
    const depthOnlyWithChildren = voronoiParents
    const isInitialized = new Array(depthOnlyWithChildren.length).fill(false);
    const isFinished = new Array(depthOnlyWithChildren.length).fill(false);
    let intersectionPoints = [];
    let isComputing = false;
    let pairsOnRank = {};
    let pairs = [];
    let pairPositions = [];
    let avgConvRatio = 0;
    let constraintsOnCurrentRank = []
    let similarityMeasures = []
    let currentStep = 0;
    let counterOptimizationSteps = 0;
    let counter = 0;
    let performedSwaps = 0;
    //Force Based Initialization
    let forceBasedInitializationFinished = false;

    $:if($initializationStrategies[$selectedInitializationStrategyID].name !== 'force'){
        forceBasedInitializationFinished = true
    }
    $:if($initializationStrategies[$selectedInitializationStrategyID].name !== 'force' && forceBasedInitializationFinished){
        forceBasedInitializationFinished = true
    }
    let linksForceInitialization = []
    let initializedPositions = false
    let swappedCells = []
    let swapListClicked
    let selectionIndex;
    let createdLinks =  []

    onMount(() => {
        createdLinks = []
        for (let k = 0; k < depthOnlyWithChildren.length; k++) {
            $voronoiCellsGroupedNSteps[depthOnlyWithChildren[k].data.id] = []
        }
        $attractionLinksPerRankNSteps[i] = []
        $linkIntersectionsPerRankNSteps[i] = []
    })

    function computeIntersections(optimizationStep){
        let segments = {}
        $attractionLinksPerRankNSteps[i][optimizationStep-1].map(lineSegment =>
        {
            let name = lineSegment.sourceID+lineSegment.targetID
            let nameInversed = lineSegment.targetID+lineSegment.sourceID
            if($doubleSidedAttractionLinks){
                segments[name] = {
                    from: {x:  lineSegment.positions[0][0], y: lineSegment.positions[0][1]},
                    to:   {x: lineSegment.positions[1][0], y: lineSegment.positions[1][1]},
                    fromName: lineSegment.sourceID,
                    toName: lineSegment.targetID,
                }
            } else {
                if(!(name in segments)&& !(nameInversed in segments)){
                    segments[name] = {
                        from: {x:  lineSegment.positions[0][0], y: lineSegment.positions[0][1]},
                        to:   {x: lineSegment.positions[1][0], y: lineSegment.positions[1][1]},
                        fromName: lineSegment.sourceID,
                        toName: lineSegment.targetID,
                    }
                }
            }
        })
    }

    export async function saveIntersections(){
        //After every map has done one step, we compute the links
        let currentPositions = []
        for(let j = 0; j < pairs.length; j++){
            let inversedLink = currentPositions.filter(d => d.targetID === pairs[j][0] && d.sourceID === pairs[j][1][0])
            if(inversedLink.length === 0) {
                currentPositions.push({
                    sourceID: pairs[j][0],
                    targetID: pairs[j][1][0],
                    positions: [
                        [$voronoiStoreIDOptimized[pairs[j][0]].centroid[0], $voronoiStoreIDOptimized[pairs[j][0]].centroid[1]],
                        [$voronoiStoreIDOptimized[pairs[j][1][0]].centroid[0], $voronoiStoreIDOptimized[pairs[j][1][0]].centroid[1]]]
                })
            } else {
            }
        }
        $attractionLinksPerRankNSteps[i].push(currentPositions)
        if ($attractionLinksPerRankNSteps[i].length === 1 && voronoiParents[0].height === 1) {
            $attractionLinksTotal.push(...currentPositions)
            $attractionLinksTotal = $attractionLinksTotal
        }
        $attractionLinksPerRankNSteps[i] = $attractionLinksPerRankNSteps[i]
    }

    async function updateConstraintsOnCurrentRank() {
        const voronoiPositions = Object.values($voronoiStoreIDOptimized).filter(d => d.originalObject && d.originalObject.data.originalData.depth === voronoiParents[0].depth + 1)
        for (let node of voronoiPositions) {
            if('similarities' in node.originalObject.data.originalData.data){
                for (let constraint of node.originalObject.data.originalData.data.similarities.constraintsFromChildren) {
                    const isAlreadyLinked = constraintsOnCurrentRank.filter(d =>
                        (d.sourceID === constraint[0] && d.targetID === node.id)
                        || (d.targetID === constraint[0] && d.sourceID === node.id)
                    )
                    if (isAlreadyLinked.length !== 1) {
                        constraintsOnCurrentRank.push({sourceID: node.id, targetID: constraint[0]})
                    }
                }
            }
        }
    }

    async function computeSimilarityDistanceMeasure(operation) {
        //We have to compute the shortest path between all linked nodes
        //Across the whole rank, so we need to take the VoronoiGraph, merge them and add links between nodes that cross ranks
        let delaunayGraphNodesLinks = []
        //Loop over all neighbours of the graph and connect them
        const voronoiPositions = Object.values($voronoiStoreIDOptimized).filter(d => d.originalObject && d.originalObject.data.originalData.depth === voronoiParents[0].depth + 1)
        const cytoscapeEdges = []
        let linkIDCounter = 0;
        for (let node of voronoiPositions) {
            for (let neighbor of node.directNeighborsAll) {
                const isAlreadyLinked = delaunayGraphNodesLinks.filter(d =>
                    (d.source === neighbor.id && d.target === node.id)
                    || (d.target === neighbor.id && d.target === node.id)
                )
                if (!(isAlreadyLinked.length > 0)) {
                    cytoscapeEdges.push({
                        group: "edges",
                        data: {id: linkIDCounter, source: node.id, target: neighbor}
                    })
                    linkIDCounter++;
                }
            }
        }
        const voronoiPositionsCytoscape = voronoiPositions.map(
            function (d) {
                let n = d.originalObject.data.originalData.data.id.replaceAll(' ', '_')
                return {
                    group: "nodes",
                    data: {id: n},
                    position: {x: d.x, y: d.y}
                }
            }
        )

        let cytoscapeDelauneyGraph = cytoscape();
        cytoscapeDelauneyGraph.add(voronoiPositionsCytoscape);
        cytoscapeDelauneyGraph.add(cytoscapeEdges);
        //Get shortest Path for all Nodes
        for (let link of constraintsOnCurrentRank) {
            let shortestPath = cytoscapeDelauneyGraph.elements().aStar({
                root: '#' + link.sourceID,
                goal: '#' + link.targetID
            })
            if (shortestPath.found) {
                link.found = shortestPath.found
                link.distance = shortestPath.distance
                link.pathNodes = shortestPath.path.nodes().map(x => x.id())
                link.pathLink = shortestPath.path.edges().map(x => x.id())
            }

        }
        let ConstraintsWithConnection = constraintsOnCurrentRank.filter(d => d.found)
        if (constraintsOnCurrentRank.length > 0) {
            // if there is a path
            similarityMeasures.push({
                operation: operation,
                medianDistance: median(ConstraintsWithConnection.map(d => d.distance)),
                maxDistance: max(ConstraintsWithConnection.map(d => d.distance)),
                '%ConstraintsPreserved': (ConstraintsWithConnection.filter(d => d.distance === 1).length / ConstraintsWithConnection.length) * 100,
                '#ConstraintsPreserved': ConstraintsWithConnection.filter(d => d.distance === 1).length
            });
        }
        similarityMeasures = similarityMeasures
        if (operation === "final Treemap" && voronoiParents[0].height === 1) { //&& voronoiPositions[0].originalObject.data.originalData.height === 0
            attractionLinksPreservedTotal.set($attractionLinksPreservedTotal += ConstraintsWithConnection.filter(d => d.distance === 1).length);
            attractionLinksPercentage.set((100 / $attractionLinksTotal.length) * $attractionLinksPreservedTotal)
            averageConverganceRate.set(mean(childMaps.map(d => d.state.convergenceRatio)))
        }
        //Count how many of the constraints are direct neighbours
        // const distZero = constraintsOnCurrentRank.filter(d => d.distance === 0)
    }

    async function swapOnRank() {
        let swaps = []
        if (isInitialized.every(d => d) && (childMaps.every(d => d.state.iterationCount === 0) )) {
            for (let i = 0; i < $maxSwaps; i++) {
                swaps = await swapOnNeighborhood();
                if (swaps.length > 0) {
                    await calculateNeighborhood();
                    await updateConstraintsOnCurrentRank();
                    await computeSimilarityDistanceMeasure("swap" + i);
                    await saveIntersections();
                    performedSwaps++;
                }
            }
        } else if (isInitialized.every(d => d) && (childMaps.every(d => d.state.iterationCount >10  && d.state.iterationCount % 20 === 0 && d.state.iterationCount < $maxIterations - 20) )) {
                swaps = await swapOnNeighborhood();
                if (swaps.length > 0) {
                    await calculateNeighborhood();
                    await updateConstraintsOnCurrentRank();
                    await computeSimilarityDistanceMeasure("swap" + i);
                    await saveIntersections();
                    performedSwaps++;
                }
        }
        return swaps
    }

    async function computeDiagramStep() {
        await calculateNeighborhood();
        //check if we are in the initial step, if yes we save the first step before optimization
        if (counter === 0) {
            await calculateNeighborhood();
            await updateConstraintsOnCurrentRank();
            await computeSimilarityDistanceMeasure("before Initialization");
            for (let k = 0; k < isInitialized.length; k++) {
                let shallowObjectArray = []
                for(let poly of childMaps[k].state.polygons){
                    let polyCopy = []
                    for (const value_i of poly.site.polygon) {
                        polyCopy.push(value_i)
                    }
                    polyCopy.site = {
                        id: poly.site.id, color: poly.site.originalObject.data.originalData.data.color,
                        constraintsFromChildren: poly.site.originalObject.data.originalData.data.constraintsFromChildren,
                        directNeighborsAll: poly.site.directNeighborsAll,
                        intersectedgescombined: poly.site.intersectedgescombined,
                        centroid: poly.site.centroid,
                        x: poly.site.x,
                        y: poly.site.y,
                        z: poly.site.z,
                        vectorSourceTarget: poly.site.vectorSourceTarget,
                        vectorAlongParent: poly.site.vectorAlongParent,
                    }
                    if('previousPosition' in poly.site.originalObject){
                        polyCopy.site.lastMovementVector = poly.site.originalObject.lastMovementVector;
                        polyCopy.site.previousPosition = poly.site.originalObject.previousPosition;
                    }
                    shallowObjectArray.push(polyCopy)
                }
                $voronoiCellsGroupedNSteps[depthOnlyWithChildren[k].data.id].push({
                    stepID: $voronoiCellsGroupedNSteps[depthOnlyWithChildren[k].data.id].length,
                    stepType: 'beforeOptimization',
                    state: shallowObjectArray,
                    polygons: childMaps[k].state.polygons,
                    iterationCount: childMaps[k].state.iterationCount,
                    convergenceRatio: childMaps[k].state.convergenceRatio,
                })
                childMaps[k].savePolygonSites();
            }
            await saveIntersections();
        }
        avgConvRatio = 0;
        if (isFinished.some(d => d === false) && counter < $maxIterations) {
            counter++;
        }
        //SwappingStep
        let swappingSteps = []
        if ($initializationStrategies[$selectedInitializationStrategyID].name === 'swapping') {
            swappingSteps.push(await swapOnRank())
        }

        Promise.all(swappingSteps).then((promiseArray) => {
            for (let k = 0; k < isInitialized.length; k++) {
                if (promiseArray && promiseArray.hasOwnProperty(k) && (promiseArray.length === promiseArray.length) && (promiseArray[k].swapped === true)) {
                    $voronoiCellsGroupedNSteps[depthOnlyWithChildren[k].data.id].push({
                        stepID: $voronoiCellsGroupedNSteps[depthOnlyWithChildren[k].data.id].length,
                        stepType: 'swapBeforeOptimization',
                        state: promiseArray[k].state
                    })
                }
            }
            if (promiseArray.some(d => d.swapped === true)) {
                saveIntersections();
            }
            return true
        }).then(() => {
            let optimizeSteps = []
            for (let k = 0; k < isInitialized.length; k++) {
                if (isFinished[k] === false) {
                    optimizeSteps.push(childMaps[k].voronoiMapStep())
                }
            }
            //Each step is a promise, wait until all Promises are resolved
            Promise.all(optimizeSteps).then(async (promiseArray) => {
                await calculateNeighborhood();
                for (let k = 0; k < isInitialized.length; k++) {
                    if (promiseArray && promiseArray.hasOwnProperty(k)) {
                        let shallowObjectArray = []
                        for(let poly of childMaps[k].state.polygons){
                            let polyCopy = []
                            for (const value_i of poly.site.polygon) {
                                polyCopy.push(value_i)
                            }
                            polyCopy.site = {
                                id: poly.site.id, color: poly.site.originalObject.data.originalData.data.color,
                                constraintsFromChildren: poly.site.originalObject.data.originalData.data.constraintsFromChildren,
                                directNeighborsAll: poly.site.directNeighborsAll,
                                intersectedgescombined: poly.site.intersectedgescombined,
                                centroid: poly.site.centroid,
                                x: poly.site.x,
                                y: poly.site.y,
                                z: poly.site.z,
                                vectorSourceTarget: poly.site.vectorSourceTarget,
                                vectorAlongParent: poly.site.vectorAlongParent,
                            }
                            if('previousPosition' in poly.site.originalObject){
                                polyCopy.site.lastMovementVector = poly.site.originalObject.lastMovementVector;
                                polyCopy.site.previousPosition = poly.site.originalObject.previousPosition;
                            }
                            shallowObjectArray.push(polyCopy)
                        }
                        $voronoiCellsGroupedNSteps[depthOnlyWithChildren[k].data.id].push({
                            stepID: $voronoiCellsGroupedNSteps[depthOnlyWithChildren[k].data.id].length,
                            stepType: 'afterOptimization',
                            state: shallowObjectArray,
                            polygons: childMaps[k].state.polygons,
                            iterationCount: childMaps[k].state.iterationCount,
                            convergenceRatio: childMaps[k].state.convergenceRatio,
                        })
                        // voronoiCellsGroupedNSteps[childMaps[k].state.iterationCount] = childMaps[k].state
                        if (childMaps[k].state.iterationCount > 0) {
                            stepsSoFar.set(promiseArray[k].iterationCount)
                            avgConvRatio += promiseArray[k].convergenceRatio;
                        }
                    }
                }
                await saveIntersections();
            })
            return true
        })
        avgConvRatio = avgConvRatio / counter;
    }

    async function calculateNeighborhood() {
        const polygons_on_depth = {}
        const neighbor_dict = {}

        for (const [key, value] of Object.entries($voronoiStoreIDOptimized)) {
            if ("originalObject" in value && value.originalObject.data.originalData.depth === voronoiParents[0].depth + 1) {
                polygons_on_depth[key] = value
            }
        }

        //loop over all edges and shorten them
        //Also fill the neighborhoods
        for (const [key, value] of Object.entries(polygons_on_depth)) {
            value.edgesForNeighbors = getEdges(value.polygon)
            value.shortendEdgeSegmentsForNeighbors = []
            for (let edge of value.edgesForNeighbors){
                value.shortendEdgeSegmentsForNeighbors.push(shortenEdge(edge))
            }
        }

        for (const [key, value] of Object.entries(polygons_on_depth)) {
            const adjacientPolygons = getAdjacent(value, Object.values(polygons_on_depth))
            neighbor_dict[key] = new Set([...adjacientPolygons].map(d => d.originalObject.data.originalData.data.id))
            value.directNeighborsAll = neighbor_dict[key]
            value.directNeighborsAllObjects = adjacientPolygons
        }

        return polygons_on_depth
    }


    async function swapOnNeighborhood() {
        //own state is in state
        //all other polygons are in $voronoiStoreIDOptimized[id]
        // All cells grouped by rank
        //Filter alll the nodes based on depth+1, as we want to compare child polygons with each other
        const polygons_on_depth = await calculateNeighborhood()
        let dirty_Ids = new Set()

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
            polygonA.directNeighborsDifferentParent = new Set([...polygonA.directNeighborsAll].filter(x => !new Set(Object.keys(polygons_same_parent)).has(x)));

            const adjacentToAPolygons = polygonA.directNeighborsAll //neighbor_dict[keyA]
            const ExpectedLinkIDsA = new Set(polygonA.originalObject.data.originalData.data.similarities.constraintsFromChildren.map(d => d[0]))
            let PolygonAcorrectNeighors = ExpectedLinkIDsA.intersection(adjacentToAPolygons)

            for (let b = 0; b < Object.keys(polygons_same_parent).length; b++) {
                const keyB = Object.keys(polygons_same_parent)[b]
                const polygonB = polygons_on_depth[keyB]
                const adjacentToBPolygons = polygonB.directNeighborsAll
                const ExpectedLinkIDsB = new Set(polygonB.originalObject.data.originalData.data.similarities.constraintsFromChildren.map(d => d[0]))
                let PolygonBcorrectNeighors = ExpectedLinkIDsB.intersection(adjacentToBPolygons)
                let total_correct = PolygonAcorrectNeighors.size + PolygonBcorrectNeighors.size

                let total_correct_after_swap = ExpectedLinkIDsA.intersection(adjacentToBPolygons).size + ExpectedLinkIDsB.intersection(adjacentToAPolygons).size
                if (total_correct_after_swap > total_correct) {
                    possible_swaps.push({"idA": keyA, "idB": keyB, "value": total_correct_after_swap - total_correct})
                } else {
                    // console.log("Does not want to swap"+keyA+" "+keyB)
                }

            }
        }
        possible_swaps.sort((a, b) => b.value - a.value)

        for (let i = 0; i < possible_swaps.length; i++) {
            const idA = possible_swaps[i].idA
            const idB = possible_swaps[i].idB

            if (dirty_Ids.has(idA) || dirty_Ids.has(idB)) {
                continue
            }

            const PolyA = polygons_on_depth[idA]
            const PolyB = polygons_on_depth[idB]
            swappedCells.push(possible_swaps[i])
            swappedCells = swappedCells
            swap(polygons_on_depth, PolyA, PolyB)
            polygons_on_depth[idA] = PolyB
            polygons_on_depth[idB] = PolyA

            dirty_Ids = new Set([idA, idB, ...PolyA.directNeighborsAll, ...PolyB.directNeighborsAll, ...dirty_Ids])
            for (let k = 0; k < childMaps[k].state.polygons; k++) {
                childMaps[k].state.polygons[k].id
            }
        }

        for (let k = 0; k < isInitialized.length; k++) {
            if (swappedCells.length > 0) {
                let shallowObjectArray = []
                for(let poly of childMaps[k].state.polygons){
                    let polyCopy = []
                    for (const value_i of poly.site.polygon) {
                        polyCopy.push(value_i)
                    }
                    polyCopy.site = {
                        id: poly.site.id, color: poly.site.originalObject.data.originalData.data.color,
                        constraintsFromChildren: poly.site.originalObject.data.originalData.data.constraintsFromChildren,
                        directNeighborsAll: poly.site.directNeighborsAll,
                        intersectedgescombined: poly.site.intersectedgescombined,
                        centroid: poly.site.centroid,
                        x: poly.site.x,
                        y: poly.site.y,
                        z: poly.site.z,
                        vectorSourceTarget: poly.site.vectorSourceTarget,
                        vectorAlongParent: poly.site.vectorAlongParent,
                    }
                    if('previousPosition' in poly.site.originalObject){
                        polyCopy.site.lastMovementVector = poly.site.originalObject.lastMovementVector;
                        polyCopy.site.previousPosition = poly.site.originalObject.previousPosition;
                    }
                    shallowObjectArray.push(polyCopy)
                }
                $voronoiCellsGroupedNSteps[depthOnlyWithChildren[k].data.id].push({
                    stepID: $voronoiCellsGroupedNSteps[depthOnlyWithChildren[k].data.id].length,
                    stepType: 'afterSwap',
                    state: shallowObjectArray,
                    polygons: childMaps[k].state.polygons,
                    iterationCount: childMaps[k].state.iterationCount,
                    convergenceRatio: childMaps[k].state.convergenceRatio,
                })
            }
        }
        return swappedCells//{swapped: swapped, state: state}
    }

    function swap(polygons_on_depth, nodeA, nodeB) {
        const idA = nodeA.originalObject.data.originalData.data.id
        const idB = nodeB.originalObject.data.originalData.data.id

        for (const neighbor of nodeA.directNeighborsAllObjects) {
            neighbor.directNeighborsAllObjects.delete(nodeA);
            neighbor.directNeighborsAllObjects.add(nodeB)
            neighbor.directNeighborsAll.delete(idA)
            neighbor.directNeighborsAll.add(idB)
        }

        for (const neighbor of nodeB.directNeighborsAllObjects) {
            neighbor.directNeighborsAllObjects.delete(nodeB);
            neighbor.directNeighborsAllObjects.add(nodeA)
            neighbor.directNeighborsAll.delete(idB)
            neighbor.directNeighborsAll.add(idA)
        }

        let tmp = nodeA.originalObject
        nodeA.originalObject = nodeB.originalObject
        nodeA.id = idB
        nodeB.originalObject = tmp
        nodeB.id = idA
    }

    function getAdjacent(current, others) {
        const return_list = new Set()
        current.intersectedges = []
        current.intersectedgesObjects = []
        current.intersectedgescombined = []
                const edges_current = current.edgesForNeighbors //getEdges(current.polygon)
                for (let edgeIndex in edges_current) {
                    let edge_current = edges_current[edgeIndex]
                    let obj = {current_polygon: current, current_edge: edge_current, adjacent: new Set()}
                    for (const indexOther in others) {
                        let other = others[indexOther]
                        if (other.id !== current.id) {
                        const edges_other = other.edgesForNeighbors //getEdges(other.polygon)
                        for (let edge_other_index in edges_other) {
                            let edge_other = edges_other[edge_other_index]
                            let [intersects, ec_s, eo_s] = intersect4(current.shortendEdgeSegmentsForNeighbors[edgeIndex], other.shortendEdgeSegmentsForNeighbors[edge_other_index])

                            if (intersects && (other !== current)) {
                                return_list.add(other)
                                obj.edge_current = ec_s
                                obj.adjacent =  obj.adjacent.add({polygon: other, edge: edge_other})
                                current.intersectedgesObjects.push({
                                    source: current.polygon.site.id,
                                    target: other.polygon.site.id
                                })
                                current.intersectedges.push({edge: edge_other, adjacentPolygons: new Set([other, current]), polygon: current, edge_current:edge_current, })
                            }
                        }
                }
            }
            current.intersectedgescombined.push(obj)
        }
        return return_list
    }

    function getEdges(points) {
        const edges = []
        for (let i = 0; i < points.length - 1; i++) {
            //edges.push([points[i], points[i + 1]])
            let s = segment(...points[i], ...points[i + 1])
            if (s.slope > Math.PI) {
                s = s.reverse()
            }
            edges.push(s)
        }

        let s = segment(...points[points.length - 1], ...points[0])
        if (s.slope > Math.PI) {
            s = s.reverse()
        }

        edges.push(s)
        return edges
    }

    let setSelectedStep = function (event) {
        counterOptimizationSteps = event.detail.value;
        createdLinks=[];
    }

    $:if (isComputing === false
        && isInitialized.every(d => d === false)
        && depthOnlyWithChildren[0].depth + 1 in $matchingStore
    ) {
        createdLinks = []
        if($similarityStore.hasOwnProperty("Romance")) {
            $similarityStore["Romance"].constraintsFromChildren.push(["Germanic", 84])
            $similarityStore["Germanic"].constraintsFromChildren.push(["Romanace", 84])
            $similarityStore["Slavic"].constraintsFromChildren.push(["Romanace", 84])
            $similarityStore["Romanace"].constraintsFromChildren.push(["Slavic", 84])
            $similarityStore["Romanace"].constraintsFromChildren.push(["Uralic", 84])
            $similarityStore["Uralic"].constraintsFromChildren.push(["Romanace", 84])
            $similarityStore["Modern_Greek"].constraintsFromChildren.push(["French", 84])
        }
        for (let i = 0; i < isInitialized.length; i++) {
            if('children' in depthOnlyWithChildren[i]){
                for (let child of depthOnlyWithChildren[i].children){
                    pairsOnRank[child.data.id] =  $similarityStore[child.data.id]
                    if(pairsOnRank[child.data.id].hasOwnProperty('pairSame') && pairsOnRank[child.data.id].pairSame !== -1){
                        pairs.push([child.data.id, pairsOnRank[child.data.id].pairSame])
                    }
                    if(pairsOnRank[child.data.id].hasOwnProperty('constraintsFromChildren') && pairsOnRank[child.data.id].constraintsFromChildren.length > 0){
                        //We have to get the parents of the child constraints and add them as links
                        let linksChildren = pairsOnRank[child.data.id].constraintsFromChildren.map(d => [child.data.id, d]).filter(d => d[1][1] > 1)

                        for(let target of pairsOnRank[child.data.id].constraintsFromChildren){
                            let matchingIndex = $similarityStore[target[0]].constraintsFromChildren.findIndex(e => e[0] === child.data.id)
                            if(matchingIndex === -1){
                                $similarityStore[target[0]].constraintsFromChildren.push([child.data.id, target[1]])
                            }
                        }
                        pairs.push(...linksChildren)
                    }
                }
            } else {
            }
        }
        pairLinks.set(pairs)
        //Compute links
        for(let j = 0; j < pairs.length; j++){
            let inversedLink = linksForceInitialization.filter(d => d.targetID === pairs[j][0] && d.sourceID === pairs[j][1][0])
            if(inversedLink.length === 0) {
                linksForceInitialization.push({
                    sourceID: pairs[j][0],
                    targetID: pairs[j][1][0],
                })
            }
        }
        //Should do the force-based initialization
        for (let map of depthOnlyWithChildren) {
            let posArray = []
            let max_X = -1
            let max_Y = -1
            let min_X = 999999
            let min_Y = 999999
            let scaleStep = 0.01
            if (map.children.length > 2) {
                if ('children' in map) {
                    for (let mapChild of map.children) {
                        //For all children of the current
                        posArray.push($projectionStore[mapChild.data.id])
                        if ($projectionStore[mapChild.data.id][0] > max_X) {
                            max_X = $projectionStore[mapChild.data.id][0]
                        }
                        if ($projectionStore[mapChild.data.id][1] > max_Y) {
                            max_Y = $projectionStore[mapChild.data.id][1]
                        }
                        if ($projectionStore[mapChild.data.id][0] < min_X) {
                            min_X = $projectionStore[mapChild.data.id][0]
                        }
                        if ($projectionStore[mapChild.data.id][1] < min_Y) {
                            min_Y = $projectionStore[mapChild.data.id][1]
                        }
                    }
                }
                let centroid_points = d3.polygonCentroid(d3.polygonHull(posArray))
                let clippingPolygonCentroid = d3.polygonCentroid(map.clippingPolygon)
                let max_X_clip = -1
                let max_Y_clip = -1
                let min_X_clip = 999999
                let min_Y_clip = 999999

                if ('children' in map) {
                    for (let mapChild of map.clippingPolygon) {
                        //For all children of the current
                        if (mapChild[0] > max_X_clip) {
                            max_X_clip = mapChild[0]
                        }
                        if (mapChild[1] > max_Y_clip) {
                            max_Y_clip = mapChild[1]
                        }
                        if (mapChild[0] < min_X_clip) {
                            min_X_clip = mapChild[0]
                        }
                        if (mapChild[1] < min_Y_clip) {
                            min_Y_clip = mapChild[1]
                        }
                    }
                }
                //Move all points to be around the centroid
                // let xScaleClip = d3.scaleLinear()
                //     .domain([min_X, max_X])
                //     .range([min_X_clip * scaleStep, max_X_clip * scaleStep])
                //
                // let yScaleClip = d3.scaleLinear()
                //     .domain([min_Y, max_Y])
                //     .range([min_Y_clip * scaleStep, max_Y_clip * scaleStep])
                let posArrayScaled = []
                // for (let pos of posArray) {
                //     posArrayScaled.push([xScaleClip(pos[0]), yScaleClip(pos[1])])
                // }

                for (let pos of posArray) {
                    const xDiff = centroid_points[0] - clippingPolygonCentroid[0];
                    const yDiff = centroid_points[1] - clippingPolygonCentroid[1];
                    let angle = Math.atan2(xDiff, yDiff)
                    let distance = Math.sqrt(yDiff * yDiff + xDiff * xDiff)
                    //THe further away b is from a as a child, the larger we have to pull it
                    // we can measure the distance in the difference of the radius
                    let positionX = pos[0] - distance * (Math.cos(angle));
                    let positionY = pos[1] - distance * (Math.sin(angle));
                    posArrayScaled.push([positionX, positionY])
                }
                posArray = posArrayScaled
                let scaledPolygon = d3.polygonHull(posArray)
                centroid_points = d3.polygonCentroid(d3.polygonHull(posArray))
                let isInsidePolygon = d3plus.polygonInside(scaledPolygon, map.clippingPolygon)
                let posArrayNew = []
                while (!d3plus.polygonInside(scaledPolygon, map.clippingPolygon) && scaleStep < 0.99)
                    //rescale points until they fit into the polygon
                {
                    posArrayNew = []
                    for (let pos of posArray) {
                        //Move all to the centroid
                        const xDiff = pos[0] - clippingPolygonCentroid[0];
                        const yDiff = pos[1] - clippingPolygonCentroid[1];
                        let angle = Math.atan2(xDiff, yDiff)
                        let distance = Math.sqrt(yDiff * yDiff + xDiff * xDiff);
                        // let kj = distance * (Math.cos(angle));
                        // let dj = distance * (Math.sin(angle));
                        let positionX = pos[0] - (distance * scaleStep * (Math.sin(angle)));
                        let positionY = pos[1] - (distance * scaleStep * (Math.cos(angle)));
                        posArrayNew.push([positionX, positionY])
                    }
                    scaleStep = scaleStep + 0.1

                    scaledPolygon = d3.polygonHull(posArrayNew)
                }
                if (scaleStep>0.99) {
                    posArray = posArrayNew
                }
                if (posArrayNew.length > 0) {
                    posArray = posArrayNew
                }
                isInsidePolygon = d3plus.polygonInside(scaledPolygon, map.clippingPolygon)
                //Create polygon from points
                // let hullchildren = d3.polygonHull(posArray)
                //Get maximum width and height of points
                //Get maximum width and height of parent cell

            } else {
                for (let child of map.children) {
                    posArray.push($projectionStore[child.data.id])
                }
            }
            if ('children' in map) {
                for (let mapChild of map.children) {
                    //For all children of the current
                    let obj = $dict[mapChild.data.id];
                    //Instead of using the VoronoiIDs, we use the scaled Positions
                    mapChild.data.initialPos = $voronoiStoreID[obj.voronoiID]
                    if (mapChild.data.initialPos === undefined) {
                        mapChild.data['initialPos'] = $voronoiStoreID[obj.parent.voronoiID]
                        console.log("no value in voronoiStore")
                    }
                }
                let kk = 0;
                for (let mapChild of map.children) {
                    //For all children of the current
                    //Instead of using the VoronoiIDs, we use the scaled Positions
                    mapChild.data.initialPos.scaledX = posArray[kk][0];
                    mapChild.data.initialPos.scaledY = posArray[kk][1];
                    $projectionStore[mapChild.data.id] = posArray[kk]
                    kk++;
                }
            }
        }
        initializedPositions = true
        if(depthOnlyWithChildren[0].depth > 0){
            $voronoiEdgesByRank[depthOnlyWithChildren[0].depth] = []
        }
    }



    $:if(isComputing === false && isInitialized.every(d => d === true)){
        isComputing = true;
        let stepper = d3.interval(async (e) => {
            //loop over all children on this rank
            //check if they have a pair
            //if yes, draw pair
            pairPositions = []
            if (!isFinished.every(d => d === true)) {
                await computeDiagramStep();
                if (currentStep % 50 === 0) {
                    await computeSimilarityDistanceMeasure("Step: " + currentStep);
                }
                currentStep++;
            }
            if (isFinished.every(d => d === true)) {
                stepper.stop();
                for (let k = 0; k < isInitialized.length; k++) {
                    let shallowObjectArray = []
                    for(let poly of childMaps[k].state.polygons){
                        let polyCopy = []
                        for (const value_i of poly.site.polygon) {
                            polyCopy.push(value_i)
                        }
                        polyCopy.site = {
                            id: poly.site.id, color: poly.site.originalObject.data.originalData.data.color,
                            constraintsFromChildren: poly.site.originalObject.data.originalData.data.constraintsFromChildren,
                            directNeighborsAll: poly.site.directNeighborsAll,
                            intersectedgescombined: poly.site.intersectedgescombined,
                            centroid: poly.site.centroid,
                            x: poly.site.x,
                            y: poly.site.y,
                            z: poly.site.z,
                            vectorSourceTarget: poly.site.vectorSourceTarget,
                            vectorAlongParent: poly.site.vectorAlongParent,
                        }
                        if('previousPosition' in poly.site.originalObject){
                            polyCopy.site.lastMovementVector = poly.site.originalObject.lastMovementVector;
                            polyCopy.site.previousPosition = poly.site.originalObject.previousPosition;
                        }
                        shallowObjectArray.push(polyCopy)
                    }
                    $voronoiCellsGroupedNSteps[depthOnlyWithChildren[k].data.id].push({
                        stepID: $voronoiCellsGroupedNSteps[depthOnlyWithChildren[k].data.id].length,
                        stepType: 'final Treemap',
                        state: shallowObjectArray,
                        polygons: childMaps[k].state.polygons,
                        iterationCount: childMaps[k].state.iterationCount,
                        convergenceRatio: childMaps[k].state.convergenceRatio,
                    })
                    childMaps[k].savePolygonSites();
                }
                counter++;
                counter++;
                await saveIntersections();
                await calculateNeighborhood();
                await computeSimilarityDistanceMeasure("final Treemap");
                $queueGroupFinished[voronoiParents[0].depth] = true

            }
        }, 5)
    }

    function handleInitializationFinished(event) {
        //console.log(event.detail.id);
        isInitialized[event.detail.id] = true;
    }

    function handleComputationFinished(event) {
        //console.log(event.detail.id);
        depthOnlyWithChildren
        isFinished[event.detail.id] = true;
        //convergenceRatio
    }

    function formatStep(v) {
        if ($voronoiCellsGroupedNSteps !== undefined && 0 in depthOnlyWithChildren && depthOnlyWithChildren[0].data.id in $voronoiCellsGroupedNSteps) {
            if(v in $voronoiCellsGroupedNSteps[depthOnlyWithChildren[0].data.id]){
                return $voronoiCellsGroupedNSteps[depthOnlyWithChildren[0].data.id][v].iterationCount + " : " + $voronoiCellsGroupedNSteps[depthOnlyWithChildren[0].data.id][v].stepType
            } else {
                return v
            }
        } else {
            return v
        }
    }

    $:{
        if (swapListClicked) {
            $hover_set.push(...swapListClicked)
            $hover_set = $hover_set
            dict
        }
    }

    function shouldDrawTabs(polygons) {
        let sim = $similarityStore[polygons[0].id].sortedListWholeRank.find((element) => element[0] === polygons[1].id)[1]
        return [$attractionLinksPerRankNSteps[polygons[0].originalObject.data.originalData.depth - 1][0].some(d => (d.sourceID === polygons[0].id && d.targetID === polygons[1].id) || (d.sourceID === polygons[1].id && d.targetID === polygons[0].id)), sim]
    }


</script>
<div class="grid grid-cols-subgrid grid-cols-6">
    {#if $initializationStrategies[$selectedInitializationStrategyID].name === 'force'}
        <div class="col-span-2">
            <h2 class="h2 mt-6">Force Initialization</h2>
            <VoronoiMapForceInitialization bind:forceBasedInitializationFinished depth="{voronoiParents}"
                                           height="{height+$offsetStroke}" initializedPositions="{initializedPositions}"
                                           links="{linksForceInitialization}"
                                           width="{width+$offsetStroke}"></VoronoiMapForceInitialization>
        </div>
    {/if}
    <div class="col-span-3">
        <h2 class="h2 mt-6">Neighborhood Preserving Optimization</h2>
        <svg height="{height+$offsetStroke}" id="optimized" style="fill-rule:evenodd;clip-rule:evenodd;" width="{width+$offsetStroke}" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                {#each depthOnlyWithChildren as nodeOptimized, j}
                        <VoronoiMapKnarfOptimized
                                on:initializationFinished={handleInitializationFinished}
                                on:computationFinished={handleComputationFinished}
                                root="{nodeOptimized}" depth="{i}" uuid="{j}" currentStep="{counterOptimizationSteps}"
                                forceBasedInitializationFinished="{forceBasedInitializationFinished}"
                                 bind:this={childMaps[j]}></VoronoiMapKnarfOptimized>
                        {#if nodeOptimized.clippingPolygon && nodeOptimized.data.id in $voronoiCellsGroupedNSteps && $voronoiCellsGroupedNSteps[nodeOptimized.data.id].length}
                            <path d="{d3.line()(nodeOptimized.clippingPolygon) + 'z'}" stroke="rgb(0, 0, 0)"
                                stroke-width="2px"
                                fill="none"
                                class="voronoiCell"
                               />
                        {/if}
                {/each}
            <g transform="translate(0,0)">
            {#each depthOnlyWithChildren as nodeOptimized, j}
                    {#if nodeOptimized.data.id in $voronoiCellsGroupedNSteps && $voronoiCellsGroupedNSteps[nodeOptimized.data.id].length > 0}
                    {@const currentStepAdjusted = counterOptimizationSteps > $voronoiCellsGroupedNSteps[nodeOptimized.data.id].length ? $voronoiCellsGroupedNSteps[nodeOptimized.data.id].length - 1 : counterOptimizationSteps}
                        {#if 'state' in $voronoiCellsGroupedNSteps[nodeOptimized.data.id][currentStepAdjusted] && $voronoiCellsGroupedNSteps[nodeOptimized.data.id][currentStepAdjusted]['state'].length > 0}
                            {#each $voronoiCellsGroupedNSteps[nodeOptimized.data.id][currentStepAdjusted]['state'] as polygon}
<!--                                                        <circle cx="{polygon.site.centroid[0]}" cy="{polygon.site.centroid[1]}" r="{$circleSize}"-->
<!--                                                                class="voronoiCellCentroid"-->
<!--                                                                data-id="{polygon.site.originalObject.data.originalData.data.id}"-->
<!--                                                                pointer-events="none"/>-->
                                 {#if $showVectors}
                                    <g id="vectors"
                                   pointer-events="none">
                                   {#if polygon.site.hasOwnProperty("vectorSourceTarget") && polygon.site.vectorSourceTarget !== undefined}
                                        <line stroke-width="5px" x1="{polygon.site.vectorSourceTarget.start.x}" y1="{polygon.site.vectorSourceTarget.start.y}" x2="{polygon.site.vectorSourceTarget.end.x}" y2="{polygon.site.vectorSourceTarget.end.y}" stroke="pink" />
                                        <circle fill="none" stroke-width="1px" stroke="red" cx="{polygon.site.vectorSourceTarget.start.x}" cy="{polygon.site.vectorSourceTarget.start.y}" r="{3}" />

                                    {/if}
                                    </g>
                                    {/if}
                                    <g transform="translate({polygon.site.centroid[0]},{polygon.site.centroid[1]})"
                                   pointer-events="none">
                                </g>
                            {/each}
                        {/if}
                    {/if}
                {/each}
                </g>
            <g transform="translate(0,0)">
                 {#each depthOnlyWithChildren as nodeOptimized, j}
                    {#if nodeOptimized.data.id in $voronoiCellsGroupedNSteps && $voronoiCellsGroupedNSteps[nodeOptimized.data.id].length > 0}
                    {@const currentStepAdjusted = counterOptimizationSteps > $voronoiCellsGroupedNSteps[nodeOptimized.data.id].length ? $voronoiCellsGroupedNSteps[nodeOptimized.data.id].length - 1 : counterOptimizationSteps}
                        {#if currentStepAdjusted > 0}
                            {#if 'state' in $voronoiCellsGroupedNSteps[nodeOptimized.data.id][currentStepAdjusted] && $voronoiCellsGroupedNSteps[nodeOptimized.data.id][currentStepAdjusted]['state'].length > 0}
                                {@const puzzleEdges = reformat($voronoiCellsGroupedNSteps[nodeOptimized.data.id][currentStepAdjusted]['state'])}

                                {@const attrLinks =  $attractionLinksPerRankNSteps[i][counterOptimizationSteps]}
                                {#each puzzleEdges as puzzleEdge}
                                        {@const neighLink =  attrLinks.filter(e => (e.sourceID === puzzleEdge.polygons[0].id && e.targetID === puzzleEdge.polygons[1].id)|| (e.targetID === puzzleEdge.polygons[0].id && e.sourceID === puzzleEdge.polygons[1].id))}
                                        {#if neighLink.length > 0 && currentStepAdjusted > 0}
                                           {#if $showSimilarityConstraints}
                                                <line x1="{puzzleEdge.polygons[0].centroid[0]}" y1="{puzzleEdge.polygons[0].centroid[1]}" x2="{puzzleEdge.polygons[1].centroid[0]}" y2="{puzzleEdge.polygons[1].centroid[1]}" stroke="green" stroke-width="3" class="similarityLink" data-sourceID="{puzzleEdge.polygons[0].id}" data-targetID="{puzzleEdge.polygons[1].id}"/>
                                           {/if}
                                           {createdLinks.push(neighLink[0])}
                                        {/if}
                                {/each}
                            {/if}
                        {/if}
                    {/if}
                 {/each}
                {#each depthOnlyWithChildren as nodeOptimized, j}
                    {#if nodeOptimized.data.id in $voronoiCellsGroupedNSteps && $voronoiCellsGroupedNSteps[nodeOptimized.data.id].length > 0}
                    {@const currentStepAdjusted = counterOptimizationSteps > $voronoiCellsGroupedNSteps[nodeOptimized.data.id].length ? $voronoiCellsGroupedNSteps[nodeOptimized.data.id].length - 1 : counterOptimizationSteps}
                        {#if currentStepAdjusted > 0}
                            {#if 'state' in $voronoiCellsGroupedNSteps[nodeOptimized.data.id][currentStepAdjusted] && $voronoiCellsGroupedNSteps[nodeOptimized.data.id][currentStepAdjusted]['state'].length > 0}
                               {@const attrLinks2 =  $attractionLinksPerRankNSteps[i][counterOptimizationSteps]}
                            {#each attrLinks2 as attrLink}
                                {@const newPosSourceParent = $dict[attrLink.sourceID].parent.data.id}

                                 {@const newPosTargetParent = $dict[attrLink.targetID].parent.data.id}
                                 {@const newPosSource = $voronoiCellsGroupedNSteps[newPosSourceParent][currentStepAdjusted]['state'].filter(e => e.site.id === attrLink.sourceID)[0]}
                                {@const newPosTarget= $voronoiCellsGroupedNSteps[newPosTargetParent][currentStepAdjusted]['state'].filter(e => e.site.id === attrLink.targetID)[0]}
                                {#if $showSimilarityConstraints}
                                    {#if  createdLinks.length === 0 || (newPosSource !== undefined && newPosTarget !== undefined && createdLinks.filter(e => (e.sourceID === attrLink.sourceID && e.targetID === attrLink.targetID)|| (e.targetID === attrLink.sourceID && e.sourceID === attrLink.targetID)).length === 0) }
                                        <line x1="{newPosSource.site.centroid[0]}" y1="{newPosSource.site.centroid[1]}" x2="{newPosTarget.site.centroid[0]}"
                                              y2="{newPosTarget.site.centroid[1]}" stroke="black" stroke-width="3" class="similarityLink" data-sourceID="{attrLink.sourceID}" data-targetID="{attrLink.targetID}"/>
                                    {/if}
                                {/if}

                            {/each}
                            {/if}
                        {/if}
                    {/if}
                {/each}
            </g>
        </svg>
        <div>
            <h2 class="h2">Optimized Voronoi Treemap</h2>
        </div>
        <div>
            {#if counter >= 0}
                <RangeSlider values={[0]} min="{0}" max="{counter+performedSwaps}" step={1} float="{true}" last={'label'}
                             handleFormatter={v => formatStep(v)} on:start={$hover_set=[]} on:change={setSelectedStep}
                             on:stop={setSelectedStep}
                             pips/>
            {/if}
        </div>
    </div>
    <div class="grid grid-cols-subgrid col-span-3 gap-4" >
        <div class=row-span-1 max-w-full overflow-y-scroll style:max-height="{height*(2/3)}px">
            <h2 class="h2 mt-6">Similarity Constraint Statistics</h2>
            <DataTable class="mt-6 max-w-fit " style="max-height: inherit;" table$aria-label="People list">
                <Head>
                    <Row>
                        <Cell>Operation</Cell>
                        <Cell>Median <br>Constraint <br>Distance</Cell>
                        <Cell>Max <br>Constraint <br>Distance</Cell>
                        <Cell>% Constraints <br> Preserved</Cell>
                        <Cell># Constraints <br> Preserved</Cell>
                    </Row>
                </Head>
                <Body>
                {#each similarityMeasures as similarityMeasurement}
                    <Row>
                        <Cell>
                            {similarityMeasurement['operation']}
                        </Cell>
                        <Cell>
                            {similarityMeasurement['medianDistance']}
                        </Cell>
                        <Cell>
                            {similarityMeasurement['maxDistance']}
                        </Cell>
                        <Cell>
                            {similarityMeasurement['%ConstraintsPreserved']}
                        </Cell>
                        <Cell>
                            {similarityMeasurement['#ConstraintsPreserved']}
                        </Cell>
                    </Row>
                {/each}
                </Body>
            </DataTable>
        </div>
        <div class="row-span-1 mt-6 max-w-full overflow-y-scroll" style:max-height="{height*(1/3)}px">
            <h2 class="h2">List of Performed Swaps</h2>
            <List class="demo-list"
                  on:focusout={() => ($hover_set = [])}
                  selectedIndex={selectionIndex}>
                {#each swappedCells as swap}
                    <Item on:SMUI:action={() => ($hover_set = [swap.idA, swap.idB])}>
                        <Text>{swap.idA} - {swap.idB} </Text>
                    </Item>
                {/each}
            </List>
        </div>
    </div>
</div>