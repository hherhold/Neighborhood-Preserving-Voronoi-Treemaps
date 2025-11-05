<script>
    import {
        colorScale,
        matchingStore,
        maxIterations,
        myseededprng,
        projectionStoreDepth,
        similarityStore,
        voronoiStoreIDOptimizedBaseline,
        voronoiStoreIDOptimizedParentsBaseline
    } from "../store";
    import {voronoiMapSimulation as d3VoronoiMapSimulation} from 'd3-voronoi-map';
    import * as d3 from "d3";
    import {createEventDispatcher} from "svelte";

    export let root = {};
    export let uuid;
    export let depth;
    export let isInitialized = false;
    export let voronoiParents = -1;

    export let equalChildren = [];
    let polygons = []
    let state = []
    let calculatedProjection = false;

    let dispatch = -1;

    function weightAccessor(d) {
        return d.value // computes the weight of one of your data; depending on your data, it may be 'd.area', or 'd.percentage', ...
    }

    function precomputedInitialPosition(d, i, arr, simulation) {
        // return [0, 0];
        if (depth === 0) {
            return [d.data.initialPos.x, d.data.initialPos.y];
            // return [...d.data.initialPos.centroid];
            //return [d.data.initialPos.x, d.data.initialPos.y];
            // return $projectionStore[d.data.id]
        } else {
            //return $projectionStore[d.data.id]
            if (d.data.initialPos !== undefined) {
                return [d.data.initialPos.x, d.data.initialPos.y];
            } else {
                return [0, 0];
            }
        }
    }

    function precomputedInitialWeight(d, i, arr, simulation) {
        return d.data.weight;
    }

    $:if (root.hasOwnProperty('clippingPolygon')
        && root.hasOwnProperty('children')
        && $matchingStore.hasOwnProperty(root.depth + 1)
        && $projectionStoreDepth.hasOwnProperty(root.depth + 1)
        && !$voronoiStoreIDOptimizedParentsBaseline.hasOwnProperty(root.data.id)
        && $voronoiStoreIDOptimizedBaseline.hasOwnProperty(root.data.id)
    ) {
        if (root.hasOwnProperty('children') && root.children.length === 0) {
            dispatch = createEventDispatcher();
            state = root.site
            //Reset Ids to be correct
            let cloneParent = structuredClone($voronoiStoreIDOptimizedBaseline[root.data.id])
            $voronoiStoreIDOptimizedBaseline[root.children[0].data.id] = cloneParent;
            $voronoiStoreIDOptimizedParentsBaseline[root.data.id] = [cloneParent]
            equalChildren = $voronoiStoreIDOptimizedParentsBaseline[root.data.id]
            //directly return the parent hull as the result
            dispatch('computationBaselineFinished', {
                id: uuid
            });
            console.log("Voronoi Optimization Finished")

        } else {
            dispatch = createEventDispatcher();
            const parentColor = root.data.color
            let colorScaleParent = $colorScale
            let totalColorRatio = root.height
            let currRatio = totalColorRatio / 4;
            if (root.depth !== 0) {
                let darkerColor = d3.hsl(parentColor).darker(currRatio * 0.5)
                let lighterColor = d3.hsl(parentColor).brighter(currRatio * 0.5)
                colorScaleParent = d3.quantize(d3.interpolateHcl(lighterColor, parentColor, darkerColor), root.children.length + 2)
            }
            root.children.map((d, i) => {
                //Set the colors of all children
                if (root.depth === 0) {
                    //If on the highest rank, we use new categorical colors
                    //Otherwise, we use the color of the parent and offset it
                    d.data.color = colorScaleParent(d.voronoiID);
                } else {
                    // const adjustedColor = d3.interpolateRgb(parentColor, "black")(polygon.site.originalObject.data.originalData.voronoiID/100);
                    d.data.color = colorScaleParent[i];

                }
                d.data.weight = 1
                d.data.similarities = $similarityStore[d.data.id]
            })
            root.children.sort((a, b) => a.voronoiID - b.voronoiID);
            equalChildren = root.children
            if (equalChildren === null) {
                console.log("No data given")
                equalChildren = root.children
            }
            console.log("Create Baseline VoronoiMap")
            //First simulate with equal weights
            let clippingVolume = $voronoiStoreIDOptimizedBaseline[root.data.id].polygon;
            let simulation = d3VoronoiMapSimulation(equalChildren)
                .prng(myseededprng)
                // .initialPosition(precomputedInitialPosition)
                .currentInitializationStrategy('random')
                .initialWeight(precomputedInitialWeight)
                .weight(weightAccessor)        // set the weight accessor
                .clip(clippingVolume)
                .maxIterationCount($maxIterations)
                .useDefault(true)// set the clipping polygon
                .stop();

            state = simulation.state();                           // retrieve the simulation's state, i.e. {ended, polygons, iterationCount, convergenceRatio}

            while (!state.ended) {
                try {
                    simulation.tick();
                } catch (e) {
                    // Anweisungen für jeden Fehler
                    console.log(e); // Fehler-Objekt an die Error-Funktion geben
                }
                state = simulation.state();
            }

            if (state.ended) {
                if (root.hasOwnProperty('children')) {
                    for (let j = 0; j < equalChildren.length; j++) {
                        let currChild = equalChildren[j];
                        let currPolygon = state.polygons.find(d => d.site.originalObject.data.originalData.data.id === currChild.data.id);
                        if (currPolygon === undefined) {
                            console.log("error, cannot find polygon")
                        }
                        currPolygon.site.id = currPolygon.site.originalObject.data.originalData.data.id
                        $voronoiStoreIDOptimizedBaseline[currChild.data.id] = currPolygon.site;
                    }
                    $voronoiStoreIDOptimizedParentsBaseline[root.data.id] = state.polygons
                } else {

                }
                dispatch('computationBaselineFinished', {
                    id: uuid
                });
                console.log("Voronoi Optimization Finished")
            }
            console.log("Finished creating the Baseline VoronoiMap for node " + root.data.id)
        }
    }


</script>
{#if $matchingStore.hasOwnProperty(root.depth + 1)
&& root.hasOwnProperty('children') && equalChildren.length > 0
}
    {#each equalChildren as polygon}
            {#if $voronoiStoreIDOptimizedBaseline.hasOwnProperty(polygon.data.id) && $voronoiStoreIDOptimizedBaseline[polygon.data.id].hasOwnProperty('polygon')}
                <path d="{d3.line()($voronoiStoreIDOptimizedBaseline[polygon.data.id].polygon) + 'z'}"
                      stroke="rgb(0, 0, 0)"
                      stroke-width="2px"
                      fill="{$voronoiStoreIDOptimizedBaseline[polygon.data.id].originalObject.data.originalData.data.color}"
                      data-voronoiID="{polygon.voronoiID}"/>
            {/if}
    {/each}
{/if}
