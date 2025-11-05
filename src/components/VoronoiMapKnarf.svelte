<script>
    import {
        counter,
        dict,
        initializationStrategies,
        maxIterations,
        myseededprng,
        projectionStore,
        projectionStoreDepth,
        selectedInitializationStrategyID,
        voronoiEdges,
        voronoiEdgesAll,
        voronoiEdgesByRank,
        voronoiStore,
        voronoiStoreID,
        voronoiStoreIDOptimized,
        voronoiStoreIDRoot
    } from "../store";
    import {voronoiMapSimulation as d3VoronoiMapSimulation} from 'd3-voronoi-map';
    import {roundArray} from "../helpers/helpers.js";

    export let root = {};
    export let depth = -1;
    export let equalChildren = [];

    let calculatedProjection = false;

    $:if (root.hasOwnProperty('clippingPolygon')
        && root.hasOwnProperty('children')
        && !$voronoiStoreIDRoot.hasOwnProperty(root.data.id)
        && $projectionStoreDepth.hasOwnProperty(depth + 1)
    ) {
        equalChildren = [];
        //Get the full breadth of children according to the root
        //Basically a flat hierarchy
        //Get the current children according to the root
        //For each child, create a node
        //ID is a unique counter
        for (let child of root.children) {
            equalChildren.push({
                depth: child.depth,
                color: child.data.color,
                data: {
                    id: $counter,
                    parent: root.data.id,
                }

            })
            counter.increment();
        }
        console.log("Create VoronoiMap")
        //First simulate with equal weights
        // let duplicate
        function precomputedInitialPosition(d, i, arr, simulation) {
            if (depth === 0) {
                return $projectionStore[root.children[i].data.id]
            } else {
                //If the positions are outside the current clippingVolume, we use the previous positions, otherwise we
                return [0, 0];
            }
        }
        let clippingVolume = $voronoiStoreIDOptimized[root.data.id].polygon;
        let simulation = d3VoronoiMapSimulation(equalChildren)
            .prng(myseededprng)
            .currentInitializationStrategy($initializationStrategies[$selectedInitializationStrategyID].name)
            // .initialPosition(precomputedInitialPosition)
            .weight(function (d) {
                return 1;
            })
            .clip(clippingVolume)
            .maxIterationCount($maxIterations)// set the clipping polygon
            .stop();

        // retrieve the simulation's state, i.e. {ended, polygons, iterationCount, convergenceRatio}
        let state = simulation.state();

        while (!state.ended) {
            try {
                // manually launch each iteration until the simulation ends
                simulation.tick();
            } catch (e) {
                // Anweisungen für jeden Fehler
                console.log(e); // Fehler-Objekt an die Error-Funktion geben
            }
            state = simulation.state();
        }
        let listEdges = []
        let sites = []
        for (let j = 0; j < equalChildren.length; j++) {
            //Are not necessarily in order
            let currChild = equalChildren[j];
            let currPolygon = state.polygons.find(d => d.site.originalObject.data.originalData.data.id === currChild.data.id)
            currChild.clippingPolygon = currPolygon
            currChild.site = currPolygon.site
            sites.push(currPolygon.site)
            currPolygon.site.clippingPolygon = currPolygon
            $voronoiStoreID[currChild.data.id] = currPolygon.site
            //Each point in the site is exactly one neighbour

            //Draw in similarities between neighbours
            //check if points lie on outline
            for (let k = 0; k < currPolygon.site.propertiesNeighboursClipped.length; k++) {
                //Loop over all points of the polygon
                let currN = currPolygon.site.propertiesNeighboursClipped[k];
                let prevIdx = k > 0 ? k - 1 : currPolygon.length - 1;
                let left = currPolygon[k];
                let right = currPolygon[prevIdx];
                if (currN.id !== -1) { //is boundary vertex
                    if (left !== undefined && right !== undefined) {
                        if (!listEdges.some(d => d.sourcePolygon === currN.id && d.targetPolygon === currChild.data.id)
                            // && prevN.id !== -1
                        ) {
                            listEdges.push(
                                {
                                    sourcePolygon: currChild.data.id,
                                    targetPolygon: currN.id,
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
                                sourcePolygon: currChild.data.id,
                                targetPolygon: currN.id,
                                line: roundArray([left, right])
                            }
                        );
                    } else {
                        if ($dict[root.data.id].site === undefined) {
                            $dict[root.data.id].site = $voronoiStoreIDOptimized[root.data.id]
                            $dict[root.data.id].clippingPolygon = $voronoiStoreIDOptimized[root.data.id].polygon
                        }
                        let parentN = $dict[root.data.id].site.propertiesNeighboursClipped[currN.parent];
                        if (parentN && parentN.id && currChild.data.id) {
                            listEdges.push(
                                {
                                    sourcePolygon: currChild.data.id,
                                    targetPolygon: parentN.id,
                                    line: roundArray([left, right])
                                }
                            );
                        }
                    }

                }
            }
        }
        $voronoiEdges[root.data.id] = listEdges

        //insert similarity
        if (listEdges.length > 0 && depth >= 0) {
            $voronoiEdgesAll.push(...listEdges)

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
        if ($voronoiStore.hasOwnProperty(root.depth)) {
            $voronoiStore[root.depth].push(...sites)
        } else {
            $voronoiStore[root.depth] = sites
        }
        $voronoiStoreIDRoot[root.data.id] = root.site
        voronoiStoreIDRoot.set($voronoiStoreIDRoot)
    }
</script>

