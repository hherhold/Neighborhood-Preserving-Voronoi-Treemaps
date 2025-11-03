<script>

    import {dict, medSimStore, medSimStoreBorder, vectorStore, voronoiEdgesByRank} from "../store"
    import {calculateMidPoint, cosineSimilarity, euclideanDist} from "../helpers/helpers";
    import Hoverable from "./Hoverable.svelte";

    export let depth = -1;

    let edgesUntilCurrRank = [];
    let edgesNeighbours = [];
    let segments = [];
    let segmentsBorder = [];
    let segmentsEdges = [];

    $:if ($voronoiEdgesByRank.hasOwnProperty(depth)
        && !$medSimStore.hasOwnProperty(depth)) { //stop from going into instance multiple times

        edgesUntilCurrRank = [];
        edgesNeighbours = [];
        segments = [];
        segmentsBorder = [];
        segmentsEdges = [];

        //If two VoronoiTreemaps on the same rank hqave broders, we need to change the parents of the links
        //Before: target is neighobour node parent root id
        //After: target is neighbourhood node on same rank
        //For each node, where the parent node is in the rank above
        //Find all links that intersect with the current link
        //Use their source as the target

        //If all the edges of the previous ranks have been added, we need
        let edges = $voronoiEdgesByRank[depth];
        edgesNeighbours = [];
        for (let edge of edges) {
            if (edge.targetPolygon === -1) {
                //on depth 0 the similarity is always 0
                edge.sim = 0;

            } else {
                let sourceNode = $dict[edge.sourcePolygon];
                let targetNode = $dict[edge.targetPolygon];
                if (
                    targetNode.depth + 1 === sourceNode.depth //target is parent, so depth+1
                    //Get only edges with different parent
                    && sourceNode.depth === depth + 1 //depth is always of the parent of the current level
                    //&& $dict[edge.target].hasOwnProperty('children') //target has children
                    && sourceNode.parent !== targetNode.parent //should not have the same parent
                )
                    //Should find intersecting edges
                {
                    for (let edgesInner of edges) {
                        // Parent cannot be the same
                        //Is other edge
                        //Lines intersect, should change parent of edge to edgesInner.source
                        // console.log(edge)
                        // console.log(edgesInner)
                        // console.log("---")

                        edge.targetID = targetNode.voronoiID
                        edge.sourceID = sourceNode.voronoiID
                        edge.sameRank = 'true'
                        let edgeCopy = {};
                        Object.assign(edgeCopy, edge);
                        let exists = edgesNeighbours.findIndex(d => edgeCopy.sourcePolygon === d.sourcePolygon
                            && edgeCopy.targetPolygon === d.targetPolygon)
                        if (exists === -1) {
                            edgesNeighbours.push(edgeCopy)
                        }
                    }
                } else if ($dict[edge.sourcePolygon].parent === $dict[edge.targetPolygon].parent) {
                    segments.push(edge)
                } else if (!$dict[edge.targetPolygon].hasOwnProperty('children')) {
                    //should not add segment if neighbour has no children, as then esgesNei
                    segments.push(edge)

                }
                //depth>0, and we have an edge between a neighbour and the current element
                let vecTarget = $vectorStore[edge.targetPolygon];
                let vecSource = $vectorStore[edge.sourcePolygon];
                let sim = cosineSimilarity(vecTarget, vecSource);
                edge.sim = Math.round(sim * 1e2) / 1e2;
            }
        }
        //Group all edges by target and source
        //a group contains all links that where
        //sourceID, targetID === parent of sourceID
        //targetID, sourceID === parent of targetID

        let groupedByParentEdge = edgesNeighbours.reduce((rv, x) => {
            if (rv.hasOwnProperty($dict[x.sourcePolygon].parent.voronoiID + '.' + x.targetID)) {
                rv[$dict[x.sourcePolygon].parent.voronoiID + '.' + x.targetID].push(x);
            } else if (rv.hasOwnProperty(x.targetID + '.' + $dict[x.sourcePolygon].parent.voronoiID)) {
                rv[x.targetID + '.' + $dict[x.sourcePolygon].parent.voronoiID].push(x);
            } else {
                rv[$dict[x.sourcePolygon].parent.voronoiID + '.' + x.targetID] = []
                rv[$dict[x.sourcePolygon].parent.voronoiID + '.' + x.targetID].push(x)
            }
            return rv;
        }, {});

        //remove duplicates
        //Need to intersect all edges so that we get smaller subedges
        //Get all unique endpoints
        //Get startpoint (left key first Point)
        //Sort by distance to startpoin
        //Throw away duplicate points
        //Create line from left to right
        for (let key in groupedByParentEdge) {
            let value = groupedByParentEdge[key]
            //Get all points of array
            //create Array of points
            let startPoint = -1;
            let endPoint = -1;
            let points = [];
            value.map(d => {
                let match = points.findIndex(e => d.line[0][0] === e.point[0] && d.line[0][1] === e.point[1]);
                if (match === -1) {
                    points.push({
                        point: d.line[0],
                        sourcePolygon: d.sourcePolygon,
                        targetPolygon: d.targetPolygon,
                    })
                } else if (d.targetPolygon !== points[match].targetPolygon) {
                    startPoint = d.line[0]
                    points[match].targetPolygon = d.sourcePolygon;

                }
                let matchSecond = points.findIndex(e => d.line[1][0] === e.point[0] && d.line[1][1] === e.point[1]);
                if (!points.some(e => d.line[1][0] === e.point[0] && d.line[1][1] === e.point[1])) {
                    points.push({
                        point: d.line[1],
                        sourcePolygon: d.sourcePolygon,
                        targetPolygon: d.targetPolygon,
                    })
                } else if (d.targetPolygon !== points[matchSecond].targetPolygon) {
                    endPoint = d.line[1]
                    points[matchSecond].targetPolygon = d.sourcePolygon;
                }
            })

            if (startPoint !== -1) {
                points.map(d => {
                    d.distStart = euclideanDist(startPoint, d.point)
                })

                //sort values by distance to startpoint
                points.sort((a, b) => a.distStart - b.distStart)
                let switchDirection = 0;
                points.map((d, i) => {
                    if ($dict[d.sourcePolygon].depth === $dict[d.targetPolygon].depth + 1) {
                        //unless for index 1 and n-2, we always switch directions
                        //need to know direction of first switch
                        if (points.length === 3 && i === 1) {
                            //use index 0
                            d.targetPolygon = points[i - 1].targetPolygon
                            d.sourcePolygon = points[i - 1].sourcePolygon
                        } else if (i === 1) {
                            //use index 0
                            if (d.sourcePolygon === points[i - 1].sourcePolygon) {
                                //should switch targetPolygon first
                                d.sourcePolygon = points[i - 1].targetPolygon
                                d.targetPolygon = points[i - 1].sourcePolygon
                                switchDirection = -1

                            } else {
                                //should switch the sourcePolygon first
                                d.targetPolygon = points[i - 1].targetPolygon
                                d.sourcePolygon = points[i - 1].sourcePolygon
                                switchDirection = 1
                            }

                        } else if (i === points.length - 2) {
                            //use index points.length - 1
                            if (switchDirection === -1) {
                                d.sourcePolygon = points[i - 1].sourcePolygon
                                d.targetPolygon = points[i + 1].sourcePolygon
                            } else if (switchDirection === 1) {
                                d.targetPolygon = points[i + 1].targetPolygon
                                //d.sourcePolygon = points[i - 1].sourcePolygon
                            }
                        } else {
                            if (switchDirection === -1) {
                                if (i % 2 === 0) {
                                    d.targetPolygon = points[i - 1].sourcePolygon
                                } else {
                                    d.sourcePolygon = points[i - 1].targetPolygon
                                }
                            } else if (switchDirection === 1) {
                                if (i % 2 === 0) {
                                    d.sourcePolygon = points[i - 1].targetPolygon
                                } else {
                                    d.targetPolygon = points[i - 1].sourcePolygon
                                }
                            }
                        }
                    } else {
                        if (switchDirection === 0) {
                            //did not switch yet, but parent are on the same rank
                            switchDirection = 1;
                        }
                    }
                })
                //go over all points once, and if their target rank is too high, take the last from the left

                if (points[0].sourcePolygon === points[1].sourcePolygon && points[0].targetPolygon === points[1].targetPolygon
                    || points[0].sourcePolygon === points[1].targetPolygon && points[0].targetPolygon === points[1].sourcePolygon) {
                    points.reverse()
                }
                //Create lines for each segment
                let borderEdges = [];
                for (let i = 0; i < points.length - 1; i++) {
                    //wrap around
                    let left = points[(i) % points.length]
                    let right = points[(i + 1) % points.length]
                    let sim = cosineSimilarity($vectorStore[left.targetPolygon], $vectorStore[left.sourcePolygon]);
                    if (left.sourcePolygon === left.targetPolygon) {
                        console.log("ERROR, same parents")
                    }
                    borderEdges.push({
                        sourcePolygon: left.sourcePolygon,
                        targetPolygon: left.targetPolygon,
                        line: [left.point, right.point],
                        sim: Math.round(sim * 1e2) / 1e2
                    });
                }
                segments.push(...borderEdges)
                segmentsBorder.push(...borderEdges)
            }
        }


        $medSimStore[depth] = Math.round(segments.reduce((a, b) => (a + b.sim), 0) / segments.length * 1e2) / 1e2;
        $medSimStoreBorder[depth] = Math.round(segmentsBorder.reduce((a, b) => (a + b.sim), 0) / segmentsBorder.length * 1e2) / 1e2;
        //Get all the edges from the previous rank, that are on the lowest level, i.e. where
        edgesUntilCurrRank = [];
        for (let i = 0; i < depth; i++) {
            edgesUntilCurrRank.push(...$voronoiEdgesByRank[i])
        }
    }

    function getLineMidpoint(edge) {
        let left = calculateMidPoint(edge.line[0][0], edge.line[1][0]);
        let right = calculateMidPoint(edge.line[0][1], edge.line[1][1]);
        if (left === right) {
            console.log('error')
        }
        return '' + left + ',' + right + '';
    }

</script>

{#if $voronoiEdgesByRank.hasOwnProperty(depth)}
    <g transform="translate(0,50)">
        <text>Average Similarity All Edges: {$medSimStore[depth]}</text>
    </g>
    <g transform="translate(0,90)">
        <text>Average Similarity Only Border: {$medSimStoreBorder[depth]}</text>
    </g>
    <g transform="translate(0,0)">
        {#each segments as edge, i}
            {#if $dict[edge.sourcePolygon].depth === depth + 1 || (typeof edge.targetPolygon === 'string'
                && $dict[edge.targetPolygon].depth === depth + 1)}
                <line x1="{edge.line[0][0]}" y1="{edge.line[0][1]}" x2="{edge.line[1][0]}" y2="{edge.line[1][1]}"
                      stroke-width="5px" stroke="red" stroke-opacity="0.2"/>
                <Hoverable let:hovering={active}>
                    <g class:active>
                        <g transform="translate({getLineMidpoint(edge)})">
                            {#if active}
                                <text>{'source: ' + edge.sourcePolygon + ' target: ' + edge.targetPolygon}</text>
                                -->
                            {:else}
                                <text>{edge.sim}</text>
                                -->
                            {/if}
                        </g>
                    </g>
                </Hoverable>
            {:else}
            {/if}
        {/each}
    </g>
{/if}

<style>
    div {
        padding: 1em;
        margin: 0 0 1em 0;
        background-color: #eee;
    }

    .active {
        background-color: #ff3e00;
        color: white;
    }
</style>
