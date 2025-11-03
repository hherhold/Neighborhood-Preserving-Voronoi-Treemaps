<script>

    import {
        projectionDone,
        projectionStore,
        projectionStoreDepth,
        projectionStoreDepthDict,
        queueGrouped,
        similarityMeasure,
        similarityMeasureDict,
        similarityStore,
        vectorStore
    } from "../store";
    import * as d3 from "d3";
    import {average} from "../helpers/helpers";

    export let nodes = [];
    export let depth = -1;
    export let width;
    export let height;
    let circles = []
    let centroids = []
    let colorDistances = [];
    let dataArray = [];
    let nodePositions = [];
    let nodePositionsDict = {};
    let proj = [];

    $: if (
        !$projectionStoreDepth.hasOwnProperty(depth + 1)
        && $projectionDone
    ) {
        circles = []
        centroids = []
        colorDistances = [];
        dataArray = [];
        nodePositions = []
        nodePositionsDict = {}

        for (let i = 0; i < nodes.length; i++) {
            //if the node has a position, otherwise aggregate from children
            if (nodes[i].data.id in $projectionStore) {
                nodePositions.push($projectionStore[nodes[i].data.id])
            } else {
            }
        }
        dataArray = nodePositions;

        let maxX = Math.max(...dataArray.map(d => d[0]))
        let minX = Math.min(...dataArray.map(d => d[0]))
        let maxY = Math.max(...dataArray.map(d => d[1]))
        let minY = Math.min(...dataArray.map(d => d[1]))

        //calc euclid distance from umap position to vornoi cells
        //outer shape has to be the same
        let offset = width / ((depth + 1) * 4);
        let x = d3.scaleLinear()
            .range([offset, width - offset])
            .domain([minX, maxX]);

        let y = d3.scaleLinear()
            .range([offset, height - offset])
            .domain([minY, maxY]);

        dataArray = dataArray.map(d => {
            return [x(d[0]), y(d[1])]
        })
        //If the similarities are already in the datafile
        for (let i = 0; i < nodes.length; i++) {
            //if similarities exist
            nodePositions[i] = dataArray[i]
            nodePositionsDict[nodes[i].data.id] = dataArray[i]
            //calculate similarities between all nodes on the current rank once
            let iID = nodes[i].data.id;
            $similarityStore[iID]['unsorted'] = {}
            $similarityStore[iID]['diffParent'] = {}
            $similarityStore[iID]['sameParent'] = {}
            if (!$similarityStore[iID].hasOwnProperty('constraintsFromChildren')) {
                $similarityStore[iID].constraintsFromChildren = []
                nodes[i].data.constraintsFromChildren = []
            }
            for (let j = 0; j < nodes.length; j++) {
                let jID = nodes[j].data.id;
                if (i !== j) {
                    let sim = $similarityMeasureDict[$similarityMeasure]($vectorStore[iID], $vectorStore[jID]);
                    $similarityStore[iID]['unsorted'][jID] = sim
                    if (nodes[i].parent.data.id !== nodes[j].parent.data.id) {
                        $similarityStore[iID]['diffParent'][jID] = sim
                    } else {
                        $similarityStore[iID]['sameParent'][jID] = sim
                    }
                }
            }
            //sort data whole rank
            $similarityStore[iID].sortedListWholeRank = Object.keys($similarityStore[iID]['unsorted']).map(function (key) {
                return [key, $similarityStore[iID]['unsorted'][key]];
            });
            $similarityStore[iID].sortedListWholeRank.sort(function (first, second) {
                return second[1] - first[1];
            });
            //sort data same parent
            $similarityStore[iID].sortedListSameParent = Object.keys($similarityStore[iID]['sameParent']).map(function (key) {
                return [key, $similarityStore[iID]['sameParent'][key]];
            });
            $similarityStore[iID].sortedListSameParent.sort(function (first, second) {
                return second[1] - first[1];
            });
            //sort data different parent
            $similarityStore[iID].sortedListDiffParent = Object.keys($similarityStore[iID]['diffParent']).map(function (key) {
                return [key, $similarityStore[iID]['diffParent'][key]];
            });
            $similarityStore[iID].sortedListDiffParent.sort(function (first, second) {
                return second[1] - first[1];
            });
            $similarityStore[iID].medSameParent = average(Object.values($similarityStore[iID]['sameParent']))
            //pairs are saved with their nodes
            // nodes[i].data.pairSame = -1;
            nodes[i].data.pairDiff = -1;
            //Remove all constraints that are below the average
            let constraintsMoreSimThanAVG = $similarityStore[iID].constraintsFromChildren.filter(d => d[1] > $similarityStore[iID].medSameParent)
            if ($similarityStore[iID].constraintsFromChildren - constraintsMoreSimThanAVG.length > 0) {
                console.log("removed unwanted constraints")
            }
            $similarityStore[iID].constraintsFromChildren = $similarityStore[iID].simBuckets[0].slice(0, 6);
            if ($similarityStore[iID].simBuckets.length > 0 && $similarityStore[iID].simBuckets[0][0] !== undefined && $similarityStore[iID].simBuckets[0][0][0] !== 0) {
                if ('constraintsFromChildren' in nodes[i].data) {
                    //We loop through the buckets, if we find a bucket with no more children, we stop
                    //If we stop after the first bucket, we get less constraints
                    for (let bucket of $similarityStore[iID].simBuckets) {
                        if (nodes[i].data['constraintsFromChildren'].length > 3) {
                            break;
                        }
                        if (bucket.length === 0) {
                            break;
                        }
                        for (let link of bucket) {
                            if (nodes[i].data['constraintsFromChildren'].findIndex(e => e[0] === link[0]) === -1) {
                                nodes[i].data['constraintsFromChildren'].push(link)
                                break;
                            }
                        }
                    }
                    $similarityStore[iID]['constraintsFromChildren'] = nodes[i].data['constraintsFromChildren']
                } else {
                    nodes[i].data['constraintsFromChildren'] = $similarityStore[iID].simBuckets[0]
                    console.log("error, no children")
                }
            } else {
                console.log("Similairty 0")
            }
            nodes[i].data.cpChangePoints = $similarityStore[iID].cpChangePoints

            // Calculate change points using cumsum
            nodes[i].data.constraintsFromChildren = nodes[i].data.constraintsFromChildren //.slice(0, 1)
            $similarityStore[iID].constraintsFromChildren = nodes[i].data.constraintsFromChildren;

            if ($similarityStore[iID].sortedListDiffParent.length > 0
                && $similarityStore[iID].sortedListSameParent.length > 1
                && $similarityStore[iID].sortedListDiffParent[0][1] > $similarityStore[iID].sortedListSameParent[Math.floor($similarityStore[iID].sortedListSameParent.length / 2)][1]
            ) {
                let result = $similarityStore[iID].sortedListDiffParent[0]
                $similarityStore[iID].pairDiff = result
                nodes[i].data.pairDiff = result
            }
        }

        $projectionStoreDepth[depth + 1] = nodePositions;
        $projectionStoreDepthDict[depth + 1] = nodePositionsDict;
        projectionStoreDepth.set($projectionStoreDepth)
        projectionStoreDepthDict.set($projectionStoreDepthDict)

        for (let id in $projectionStoreDepthDict[depth + 1]){
            proj.push($projectionStore[id])
        }
    }

</script>

<svg height="{height*2}" id="projection" width="{width}">
    {#if $projectionStoreDepthDict.hasOwnProperty(depth + 1) }
        {#each $queueGrouped[depth] as node}
            {#if node.hasOwnProperty('clippingPolygon') && proj !== undefined && proj.length > 2 }
            <path d="{d3.line()(node.clippingPolygon) + 'z'}" stroke="rgb(0, 0, 0)" stroke-width="1px"
                  fill="none"
                  pointer-events="all"/>
                <g transform="translate({d3.polygonCentroid(node.clippingPolygon)[0]},{d3.polygonCentroid(node.clippingPolygon)[1]})">
                    <text>{"hullCentroid"}</text>
                    <circle class="labelsCircleBig" r="{1}" cx="{0}" cy="{0}" fill="black">
                    </circle>
                </g>
                <g transform="translate({d3.polygonCentroid(d3.polygonHull(proj))[0]},{d3.polygonCentroid(d3.polygonHull(proj))[1]})">
                    <text>{"hull"}</text>
                    <circle class="labelsCircleBig" r="{1}" cx="{0}" cy="{0}" fill="black">
                    </circle>
                </g>
            {/if}
        {/each}
        {#each Object.entries($projectionStoreDepthDict[depth + 1]) as [id, node]}
            {#if $projectionStore[id].hasOwnProperty(id) }
                <g transform="translate({$projectionStore[id][0]},{$projectionStore[id][1]})">
                                    <text>{id}</text>
                    <circle class="labelsCircleBig" r="{1}" cx="{0}" cy="{0}" fill="black">
                    </circle>
                </g>
            {/if}
        {/each}
    {/if}
</svg>


