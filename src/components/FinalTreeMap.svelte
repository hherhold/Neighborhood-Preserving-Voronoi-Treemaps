<script>

    import {
        attractionLinksPerRankNSteps,
        averageBoundingBoxAspectRatio,
        clippingPolygonOuter,
        datasetID,
        dict,
        finalPolygons,
        offsetStroke,
        queueGrouped,
        showIcons,
        showmissingLinks,
        showNames,
        similarityStore,
        visualizationWidth
    } from "../store";
    import {getOverlap, shortenEdge} from "../helpers/helpers.js";
    import * as d3 from "d3";
    import PuzzleTab from "./PuzzleTab.svelte";
    import {Polygon, Segment} from "@flatten-js/core";
    import Unlinked from "./Unlinked.svelte";

    export let width = 640;
    export let height = 640;

    let intersected = [];
    let lines = [];
    let computedIntersections = false;

    let hoveredPolygon = null

    $:if (
        $finalPolygons.length > 0
    ) {
        $queueGrouped
        let aspectRatios = []
        //array of all lines
        lines = [];
        for (let i = 0; i < $finalPolygons.length; i++) {
            for (let j = 0; j < $finalPolygons[i].polygon.length; j++) {
                lines.push([
                    $finalPolygons[i].polygon[j],
                    $finalPolygons[i].polygon[(j + 1) % $finalPolygons[i].polygon.length]
                ])
            }
            const b = new Polygon($finalPolygons[i].polygon).box
            $finalPolygons[i].boundingBox = b
            let w = b.xmax - b.xmin
            let h = b.ymax - b.ymin
            aspectRatios.push((w / h))
        }
        $averageBoundingBoxAspectRatio = aspectRatios.reduce((p, c) => p + c, 0) / aspectRatios.length;
        computedIntersections = true;
    }

    function styleEdge(polygon, intersectedObject) {
        let isConstraint = polygon.originalObject.data.originalData.data.similarities.constraintsFromChildren.filter(d => d[0] === intersectedObject.target).length
        if (isConstraint > 0) {
            return 'constraintOutlineDash'
        } else {
            return ""
        }
    }

    function edgeWidth(polygon) {
        return (polygon.polygon.site.originalObject.data.originalData.height + 1) * 5
    }

    function calculatEdges(polygons) {
        let allEdges = []
        for (const polygon of polygons) {
            if (polygon.polygon.site.intersectedgescombined && polygon.originalObject.data.originalData.height === 0) {
                for (const obj of polygon.polygon.site.intersectedgescombined) {
                    allEdges.push(obj)
                }
            }
        }
        let duplicateFreeEdges = removeduplicateEdges2(allEdges)
        duplicateFreeEdges = duplicateFreeEdges.sort((a, b) => a.current_edge.length - b.current_edge.length)
        return chopEdges2(duplicateFreeEdges)
    }

    function chopEdges2(edges) {
        let returnlist = []
        for (const edge of edges) {
            if (edge.adjacent.size < 1) {
                continue
            }
            for (const adjacent of [...edge.adjacent]) {
                let overlap = getOverlappingsegment(edge.current_edge, adjacent.edge)
                if (overlap) {
                    returnlist.push({
                        edge: overlap,
                        polygons: [edge.current_polygon, adjacent.polygon]
                    })
                }
            }
        }
        returnlist = returnlist.sort((a, b) => a.edge.length - b.edge.length)
        let finalList = []
        for (const candidate of returnlist) {
            let onEdge = false
            for (const finaledge of finalList) {
                if (finaledge.edge.distanceTo(shortenEdge(candidate.edge, 0.01))[0] < 0.001
                    && Math.abs(finaledge.edge.slope - candidate.edge.slope) < 0.01) {
                    onEdge = true
                    break
                }
            }
            if (!onEdge) {
                finalList.push(candidate)
            }
        }
        return finalList
    }

    function getOverlappingsegment(s1, s2) {
        if (s1.contains(s2.ps) && s1.contains(s2.pe)) {
            return s2
        }
        if (s2.contains(s2.ps) && s1.contains(s2.pe)) {
            return s1
        }
        if (s1.contains(s2.ps)) {
            return new Segment(s2.ps, s1.pe)
        }
        if (s1.contains(s2.pe)) {
            return new Segment(s1.ps, s2.pe)
        }
        if (s2.contains(s1.ps)) {
            return new Segment(s1.ps, s2.pe)
        }
        if (s2.contains(s1.pe)) {
            return new Segment(s2.ps, s1.pe)
        }
        return null
    }


    function removeduplicateEdges2(edges) {
        const returnList = []
        for (let i = 0; i < edges.length; i++) {
            const edgeI = edges[i]
            let isDuplicate = false
            for (const edgeJ of returnList) {
                if (edgeI.current_edge.equalTo(edgeJ.current_edge)
                    || (edgeI.current_edge.ps.distanceTo(edgeJ.current_edge.ps) < 0.1 &&
                        edgeI.edge.pe.distanceTo(edgeJ.current_edge.pe) < 0.1)
                    && Math.abs(edgeI.current_edge.slope - edgeJ.current_edge.slope) < 0.1) {

                    isDuplicate = true
                }
            }
            if (!isDuplicate) {
                returnList.push(edgeI)

            }
        }
        return returnList
    }

    function getOverlaps(edges) {
        const returnEdges = []
        edges.sort((edgeA, edgeB) => distance(edgeA.edge[0][0], edgeA.edge[0][1], edgeA.edge[1][0],
            edgeA.edge[1][1]) - distance(edgeB.edge[0][0], edgeB.edge[0][1], edgeB.edge[1][0], edgeB.edge[1][1]))

        for (const edgeA of edges) {
            let isoverlapping = false
            for (let edgeB of returnEdges) {
                let overlap = getOverlap2(edgeB.edge, edgeA.edge)
                if (overlap) {
                    isoverlapping = true
                    edgeB.height = Math.max(edgeA.height, edgeB.height)
                }
            }
            if (!isoverlapping) {
                returnEdges.push(edgeA)
            }

        }
        return returnEdges

    }

    function getOverlaps2(currentEdges, lowerEdges) {
        let overlaps = []
        for (const currentEdge of currentEdges) {
            for (const lowerEdge of lowerEdges) {
                const overlap = getOverlap(
                    lowerEdge.edge[0][0], lowerEdge.edge[0][1],
                    lowerEdge.edge[1][0], lowerEdge.edge[1][1],
                    currentEdge.edge[0][0], currentEdge.edge[0][1],
                    currentEdge.edge[1][0], currentEdge.edge[1][1])
                if (overlap || true) {
                    overlaps.push(lowerEdge.edge)
                }
            }
        }
        return overlaps
    }

    $:edges = calculatEdges($finalPolygons)
    function distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1))
    }
    function getOverlap2(e1, e2) {

        let [ax1, ay1] = e1[0]
        let [ax2, ay2] = e1[1]
        let [bx1, by1] = e2[0]
        let [bx2, by2] = e2[1]

        const lenA = distance(ax1, ay1, ax2, ay2)
        const lenB = distance(bx1, by1, bx2, by2)
        const dirA = [(ax2 - ax1) / lenA, (ay2 - ay1) / lenA]
        const dirB = [(bx2 - bx1) / lenB, (by2 - by1) / lenB]
        const angle = Math.acos((dirA[0] * dirB[0] + dirA[1] * dirB[1]))
        let t1 = Math.abs(distToSegment(ax1, ay1, bx1, by1, bx2, by2))
        let t2 = Math.abs(distToSegment(ax2, ay2, bx1, by1, bx2, by2))

        return (Math.abs(angle) < 0.001 || Math.abs(angle - Math.PI) < 0.01) && ((t1 > 0.01 && t1 < 0.99) || (t2 > 0.01 && t2 < 0.99));
    }

    function distToSegment(px, py, lax, lay, lbx, lby) {
        let dx = lbx - lax
        let dy = lby - lay
        let l2 = dx * dx + dy * dy;

        if (l2 === 0.0)
            return Number.POSITIVE_INFINITY
        return ((px - lax) * dx + (py - lay) * dy) / l2;
    }


    function shouldDrawTabs(polygons) {
        let sim = $similarityStore[polygons[0].id].sortedListWholeRank.find((element) => element[0] === polygons[1].id)[1]
        return [$attractionLinksPerRankNSteps[polygons[0].originalObject.data.originalData.depth - 1][0].some(d => (d.sourceID === polygons[0].id && d.targetID === polygons[1].id) || (d.sourceID === polygons[1].id && d.targetID === polygons[0].id)), sim]
    }

    function getDisplayName(id) {
        if ($dict[id].data.hasOwnProperty("name")) {
            return $dict[id].data.name
        }
        return $dict[id].data.id
    }

    function hasUnlinkedContraints(polygon) {
        if ('constraintsFromChildren' in polygon.originalObject.data.originalData.data) {
            let unlinkedContraints = polygon.originalObject.data.originalData.data.constraintsFromChildren.filter(d => !polygon.intersectedgesObjects.some(e => e.target === d[0]))
            if (unlinkedContraints && unlinkedContraints.length > 0) {
                return unlinkedContraints;
            }

        }
        $datasetID
        return [];
    }

    let chain = []

    $:connections = []

    $:allMissingLinks = []

    $:{
        let processedIDs = new Set()
        for (const polygon of $finalPolygons) {
            if (polygon.polygon.site.originalObject.data.originalData.height === 0 && hasUnlinkedContraints(polygon).length > 0) {
                processedIDs.add(polygon.id)
                for (const other of getMissingLinks(polygon)) {
                    if (!processedIDs.has(other[2])) {
                        allMissingLinks.push([other[0], other[1]])
                    }
                }
            }
        }
        allMissingLinks = allMissingLinks
    }

    function getMissingLinks(polygon) {
        let missingLinks = hasUnlinkedContraints(polygon)
        let missingConnection = []
        for (const link of missingLinks) {
            if($dict[link[0]].site !== undefined){
                let other = $dict[link[0]].site.centroid
                missingConnection.push([polygon.centroid, other, $dict[link[0]].site.id])
            }
        }
        return missingConnection
    }

    function hover(polygon) {
        hoveredPolygon = polygon.polygon.site.id
        let missingLinks = hasUnlinkedContraints(polygon)
        for (const link of missingLinks) {
            if($dict[link[0]].site !== undefined){
                let other = $dict[link[0]].site.centroid
                connections.push([polygon.centroid, other])
            }
        }
        connections = connections

        let current = polygon.originalObject.data.originalData
        chain = []

        while (current.parent !== null) {
            if (current.data.hasOwnProperty("name")) {
                chain.push(current.data.name)
            } else {
                chain.push(current.data.id)
            }
            current = current.parent
        }
        chain.push("root")
        chain = chain.reverse()
    }

</script>


<svg height="{height}" id="final" width="{width}">
    <defs>
        <filter height="1" id="solid" width="1" x="0" y="0">
            <feFlood flood-color="white" result="bg"/>
            <feMerge>
                <feMergeNode in="bg"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
    </defs>
    {#each $finalPolygons as polygon}
        <path d="{d3.line()(polygon.polygon) + 'z'}" stroke="black"
              stroke-width="0"
              fill="{polygon.polygon.site.originalObject.data.originalData.data.color || 'none'}"
              on:mouseenter={() => {hover(polygon )}}
              on:mouseleave={()=> {hoveredPolygon = null; chain = []; connections = []}}/>
        { #if polygon.polygon.site.intersectedges !== undefined && false}
            {#each polygon.polygon.site.intersectedges as edgeInner, j}
                <line x1={edgeInner[0][0]} y1="{edgeInner[0][1]}" x2={edgeInner[1][0]} y2={edgeInner[1][1]}
                      stroke="black" stroke-width="{edgeWidth(polygon)}"
                      class="{styleEdge(polygon.polygon.site, polygon.polygon.site.intersectedgesObjects[j])}"/>
            {/each}
        {/if}
    {/each}

    {#each edges as edgeInner}
        <PuzzleTab x1={edgeInner.edge.ps.x} y1="{edgeInner.edge.ps.y}" x2={edgeInner.edge.pe.x}
                   y2={edgeInner.edge.pe.y}
                   polygons="{edgeInner.polygons}" drawTab="{shouldDrawTabs(edgeInner.polygons)}"></PuzzleTab>
    {/each}
    {#if $clippingPolygonOuter.length > 0}
        <circle cx="{( $visualizationWidth / 2) + $offsetStroke}" cy="{ $visualizationWidth / 2 + $offsetStroke}"
                r="{$visualizationWidth/2}" stroke="black" stroke-width="{$queueGrouped[0][0].height+1}"
                fill="none"/>
    {/if}

    {#each connections as connection}
        <line stroke-width="2px" stroke="black" x1={connection[0][0]} y1={connection[0][1]} x2={connection[1][0]}
              y2={connection[1][1]} pointer-events="none"></line>
    {/each}

    {#each $finalPolygons as polygon}
        <g transform="translate({polygon.polygon.site.centroid[0]},{polygon.polygon.site.centroid[1]})"
           pointer-events="none">
            {#if polygon.polygon.site.originalObject.data.originalData.height === 0
            && (hoveredPolygon === null && $showNames || hoveredPolygon === polygon.polygon.site.id)}
                {#if ($datasetID === 5) || ($datasetID === 6) }
                    <text filter={hoveredPolygon === polygon.polygon.site.id ? "url(#solid)" : ""}
                          background-color="white" text-anchor="middle"
                          dy="0.25em" stroke="rgb(0, 0, 0)" pointer-events="none">{getDisplayName(polygon.polygon.site.id)}</text>
                {:else}
                    <text filter={hoveredPolygon === polygon.polygon.site.id ? "url(#solid)" : ""}
                          background-color="white" text-anchor="middle" fill="green"
                          dy="0.25em" stroke="rgb(0, 0, 0)"
                          pointer-events="none">{getDisplayName(polygon.polygon.site.id)}</text>
                {/if}
            {/if}
            {#if polygon.polygon.site.originalObject.data.originalData.height === 0
            && hasUnlinkedContraints(polygon).length > 0 && ($showIcons || hoveredPolygon === polygon.polygon.site.id)}
                <g transform="translate(-10,10)">
                    <Unlinked number={hasUnlinkedContraints(polygon).length}/>
                </g>
            {/if}
        </g>
    {/each}

    {#if $showmissingLinks}
        {#each allMissingLinks as connection}
            <line stroke-width="2px" stroke="red" stroke-dasharray="4" x1={connection[0][0]} y1={connection[0][1]}
                  x2={connection[1][0]}
                  y2={connection[1][1]} pointer-events="none"></line>
        {/each}
    {/if}
</svg>
<div>
    {#each chain as item, index}
        {#if (index !== chain.length - 1)}
            {item + "->"}
        {:else }
            {item}
        {/if}
    {/each}
</div>


