<script>
    import {getCircularPosition} from "../helpers/helpers.js";
    import {Line, Point, Segment, Vector} from "@flatten-js/core";
    import {dataStore, edgeMultiplier, queueGrouped, tabMultiplier} from "../store.js";

    export let x1
    export let y1
    export let x2
    export let y2
    export let r = 8
    export let puzzlePieceWidth = 8
    export let basepuzzlePieceLength = 6

    let slope
    export let polygons
    export let drawTab
    let shouldDrawTab = drawTab[0]
    let sim = drawTab[1]
    let simMultiplicator = 1

    if (sim >= 0.5) {
        simMultiplicator = 1.25
    }
    if (sim >= 0.75) {
        simMultiplicator = 1.5
    }
    if (sim >= 0.95) {
        simMultiplicator = 2
    }

    $:puzzlePieceLength = basepuzzlePieceLength * (simMultiplicator * $tabMultiplier)
    $:edge = new Segment(new Point(x1, y1), new Point(x2, y2))
    $:maxWeightPolygon = polygons[0].weight > polygons[1].weight ? polygons[0] : polygons[1]
    $:minWeightPolygon = polygons[0].weight < polygons[1].weight ? polygons[0] : polygons[1]

    let c1, c2, c1_online, c2_online, l, p, p1
    let strokeWidth;

    $:{
        c1 = getCircularPosition(r, 45 + edge.slope * 180 / Math.PI, [edge.middle().x, edge.middle().y])
        c2 = getCircularPosition(r, 135 + edge.slope * 180 / Math.PI, [edge.middle().x, edge.middle().y])
        l = new Line(edge.ps, edge.pe)

        c1_online = new Point(...c1).projectionOn(l)
        c2_online = new Point(...c2).projectionOn(l)

        let d = new Vector(c1_online, new Point(...c1)).normalize().dot(new Vector(edge.middle(), new Point(...maxWeightPolygon.centroid)).normalize())
        if (d < 0) {
            edge = edge.reverse()
            c1 = getCircularPosition(r, 45 + edge.slope * 180 / Math.PI, [edge.middle().x, edge.middle().y])
            c2 = getCircularPosition(r, 135 + edge.slope * 180 / Math.PI, [edge.middle().x, edge.middle().y])
            l = new Line(edge.ps, edge.pe)
            c1_online = new Point(...c1).projectionOn(l)
            c2_online = new Point(...c2).projectionOn(l)
        }
        p = new Vector(edge.ps, edge.pe).normalize()
        p1 = p.rotate90CCW().multiply(puzzlePieceLength)
        let left;
        let right;
        $dataStore.each(function (node) {
            if (node.data.id === polygons[0].id) {
                left = node
            }
        });
        $dataStore.each(function (node) {
            if (node.data.id === polygons[1].id) {
                right = node
            }
        });

        let path = left.path(right)
        let minDepth = path.reduce(function (prev, curr) {
            if (curr.originalDepth) {
                return prev.depth < curr.originalDepth ? prev : curr;
            }
            return prev.depth < curr.depth ? prev : curr;
        });
        strokeWidth = ($queueGrouped[0][0].height - (minDepth.depth)) * $edgeMultiplier
    }

    function printInfo() {
        // console.log(polygons.map(d => d))
    }
</script>


{#if shouldDrawTab && edge && edge.middle().hasOwnProperty('x') && edge.middle().hasOwnProperty('y') && edge.pointAtLength(edge.length / 2 + puzzlePieceWidth / 2)}
    <path d="M {edge.middle().x+p1.x*0.5} {edge.middle().y+p1.y*0.5} L {edge.pointAtLength(edge.length/2+puzzlePieceWidth/2).x} {edge.pointAtLength(edge.length/2+puzzlePieceWidth/2).y} l {p1.invert().x} {p1.invert().y} l{p.invert().multiply(puzzlePieceWidth/2).x} {p.invert().multiply(puzzlePieceWidth/2).y} z"
          fill="{maxWeightPolygon.polygon.site.originalObject.data.originalData.data.color || 'none'}" stroke="none"
          on:mouseenter={printInfo}></path>

    <path d="M {edge.middle().x-p1.x*0.5} {edge.middle().y-p1.y*0.5} L {edge.pointAtLength(edge.length/2-puzzlePieceWidth/2).x} {edge.pointAtLength(edge.length/2-puzzlePieceWidth/2).y} l {p1.x} {p1.y} l{p.multiply(puzzlePieceWidth/2).x} {p.multiply(puzzlePieceWidth/2).y} z"
          fill="{minWeightPolygon.polygon.site.originalObject.data.originalData.data.color || 'none'}" stroke="none"
          on:mouseenter={printInfo}></path>

    <path d="M   {edge.pointAtLength(edge.length/2-puzzlePieceWidth/2).x} {edge.pointAtLength(edge.length/2-puzzlePieceWidth/2).y} l
                {p1.x} {p1.y} l {p.multiply(puzzlePieceWidth/2).x} {p.multiply(puzzlePieceWidth/2).y} l {p1.invert().multiply(2).x} {p1.invert().multiply(2).y} l {p.multiply(puzzlePieceWidth/2).x} {p.multiply(puzzlePieceWidth/2).y} {p1.multiply(1).x} {p1.multiply(1).y}"
          fill='none' stroke="black"
          on:mouseenter={printInfo}></path>

    <path d="M {edge.ps.x} {edge.ps.y} L  {edge.pointAtLength(edge.length/2-puzzlePieceWidth/2).x} {edge.pointAtLength(edge.length/2-puzzlePieceWidth/2).y} "
          fill='none' stroke="black" stroke-width="{strokeWidth}"
          on:mouseenter={printInfo}></path>

    <path d="M {edge.pointAtLength(edge.length/2+puzzlePieceWidth/2).x} {edge.pointAtLength(edge.length/2+puzzlePieceWidth/2).y} L {edge.pe.x} {edge.pe.y} "
          fill='none' stroke="black" stroke-width="{strokeWidth}"
          on:mouseenter={printInfo}></path>

{:else }
    <path d="M {edge.ps.x} {edge.ps.y} L  {edge.pe.x} {edge.pe.y}" fill="black" stroke="black"
          stroke-width="{strokeWidth}"
          on:mouseenter={printInfo}></path>
{/if}

