<svelte:options accessors/>

<script>
    import {
        hover_set,
        matchingStore,
        offsetStroke,
        similarityMeasuresBaseline,
        similarityMeasuresBaselineNumberPreserved,
        similarityMeasuresBaselinePercentagePreserved,
        voronoiStoreIDOptimizedBaseline
    } from "../store";
    import {intersect4, shortenEdge} from "../helpers/helpers.js";
    import cytoscape from 'cytoscape';
    import {max, median} from "mathjs";
    import VoronoiMapKnarfBaseline from "./VoronoiMapKnarfBaseline.svelte";
    import {segment} from "@flatten-js/core";

    export let i;
    export let voronoiParents;
    export let width;
    export let height;

    const childMaps = [];
    let depthOnlyWithChildren = []
    let isBaselineFinished = [];
    let intersectionPoints = [];
    let isComputing = false;
    let pairsOnRank = {};
    let pairs = [];
    let pairPositions = [];
    let avgConvRatio = 0;

    let constraintsOnCurrentRankBaseline = []
    // let similarityMeasures = []

    let currentStep = 0;
    let counterOptimizationSteps = 0;
    let counter = 0;
    let performedSwaps = 0;

    //Force Based Initialization
    let forceBasedInitializationFinished = true;
    let linksForceInitialization = []
    let initializedPositions = false

    let swappedCells = []
    let swapListClicked

    function updateConstraintsOnCurrentRank() {
        const voronoiPositions = Object.values($voronoiStoreIDOptimizedBaseline).filter(d => d.originalObject && d.originalObject.data.originalData.depth === voronoiParents[0].depth + 1)
        for (let node of voronoiPositions) {
            for (let constraint of node.originalObject.data.originalData.data.similarities.constraintsFromChildren) {
                const isAlreadyLinked = constraintsOnCurrentRankBaseline.filter(d =>
                    (d.sourceID === constraint[0] && d.targetID === node.id)
                    || (d.targetID === constraint[0] && d.sourceID === node.id)
                )
                if (isAlreadyLinked.length !== 1) {
                    constraintsOnCurrentRankBaseline.push({sourceID: node.id, targetID: constraint[0]})
                }
            }
        }
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
                            // if (current.intersectedges === undefined) {
                            //     current.intersectedges = []
                            //     current.intersectedgesObjects = []
                            // }


                            // if (current.intersectedges.some(edge => edge[0][0] === start_current[0] && edge[0][1] === start_current[1] && edge[1][0] === end_current[0] && edge[1][1] === end_current[1])) {
                            //continue
                            // }
                            //current.intersectedges.push({edge: ec_s, adjacentPolygons: new Set([other]), polygon: current})
                            obj.edge_current = ec_s
                            //obj.adjacentPolygons.add(other)
                            obj.adjacent = obj.adjacent.add({polygon: other, edge: edge_other})
                            current.intersectedgesObjects.push({
                                source: current.polygon.site.id,
                                target: other.polygon.site.id
                            })
                            current.intersectedges.push({
                                edge: edge_other,
                                adjacentPolygons: new Set([other, current]),
                                polygon: current,
                                edge_current: edge_current,
                            })
                        }
                    }
                }
            }
            current.intersectedgescombined.push(obj)
        }
        return return_list
    }

    function calculateNeighborhoodBaseline() {
        const polygons_on_depth = {}
        const neighbor_dict = {}
        for (const [key, value] of Object.entries($voronoiStoreIDOptimizedBaseline)) {
            if ("originalObject" in value && value.originalObject.data.originalData.depth === voronoiParents[0].depth + 1) {
                polygons_on_depth[key] = value
            }
        }
        //loop over all edges and shorten them
        //Also fill the neighborhoods
        for (const [key, value] of Object.entries(polygons_on_depth)) {
            // const edges_current = getEdges(value.polygon)
            value.edgesForNeighbors = getEdges(value.polygon)
            value.shortendEdgeSegmentsForNeighbors = []
            for (let edge of value.edgesForNeighbors) {
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

    function calculatesimilarityMeasuresBaseline() {
        if (constraintsOnCurrentRankBaseline.length > 0 && voronoiParents[0].height === 1) {
            //Similarity Measures
            let delaunayGraphNodesLinks = []
            //Loop over all neighbours of the graph and connect them
            const voronoiPositions = Object.values($voronoiStoreIDOptimizedBaseline).filter(d => d.originalObject && d.originalObject.data.originalData.depth === voronoiParents[0].depth + 1)
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
                    return {
                        group: "nodes",
                        data: {id: d.originalObject.data.originalData.data.id},
                        position: {x: d.x, y: d.y}
                    }
                }
            )

            let cytoscapeDelauneyGraph = cytoscape();
            cytoscapeDelauneyGraph.add(voronoiPositionsCytoscape);
            cytoscapeDelauneyGraph.add(cytoscapeEdges);
            //Get shortest Path for all Nodes
            for (let link of constraintsOnCurrentRankBaseline) {
                let shortestPath = cytoscapeDelauneyGraph.elements().aStar({
                    root: '#' + link.sourceID,
                    goal: '#' + link.targetID
                })
                link.distance = shortestPath.distance
                link.pathNodes = shortestPath.path.nodes().map(x => x.id())
                link.pathLink = shortestPath.path.edges().map(x => x.id())
            }
            $similarityMeasuresBaseline.push({
                operation: 'finalTreemap',
                medianDistance: median(constraintsOnCurrentRankBaseline.map(d => d.distance)),
                maxDistance: max(constraintsOnCurrentRankBaseline.map(d => d.distance)),
                '%ConstraintsPreserved': (constraintsOnCurrentRankBaseline.filter(d => d.distance === 1).length / constraintsOnCurrentRankBaseline.length) * 100,
                '#ConstraintsPreserved': constraintsOnCurrentRankBaseline.filter(d => d.distance === 1).length
            });
            similarityMeasuresBaselineNumberPreserved.set(constraintsOnCurrentRankBaseline.filter(d => d.distance === 1).length)
            similarityMeasuresBaselinePercentagePreserved.set((constraintsOnCurrentRankBaseline.filter(d => d.distance === 1).length / constraintsOnCurrentRankBaseline.length) * 100)
        }
        $similarityMeasuresBaseline = $similarityMeasuresBaseline
    }

    $:if (voronoiParents.length > 0 && voronoiParents[0].depth + 1 in $matchingStore) {
        isBaselineFinished = new Array(voronoiParents.length).fill(false);
    }


    $:if (isBaselineFinished.length > 0 && isBaselineFinished.every(d => d === true)) {
        isComputing = true;
        updateConstraintsOnCurrentRank()
        calculateNeighborhoodBaseline();
        calculatesimilarityMeasuresBaseline()
    }

    function handleComputationBaselineFinished(event) {
        console.log("finish")
        if (isBaselineFinished.length >= event.detail.id) {
            isBaselineFinished[event.detail.id] = true;
        }
    }

    $:{
        if (swapListClicked) {
            $hover_set.push(...swapListClicked)
            $hover_set = $hover_set
        }
    }

</script>

<svg height="{height+$offsetStroke}" id="optimized" style="fill-rule:evenodd;clip-rule:evenodd;"
     width="{width+$offsetStroke}" xml:space="preserve" xmlns="http://www.w3.org/2000/svg">
                     {#each voronoiParents as nodeOptimized, j}
                        <VoronoiMapKnarfBaseline
                                on:computationBaselineFinished={handleComputationBaselineFinished}
                                depth="{i}"
                                uuid="{j}"
                                root="{nodeOptimized}"
                                bind:this={childMaps[j]}></VoronoiMapKnarfBaseline>
                    {/each}
        </svg>