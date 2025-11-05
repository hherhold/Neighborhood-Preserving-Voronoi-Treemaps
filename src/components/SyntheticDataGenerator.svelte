<script>

    // Three clusters, at different distances from each other, in any dimension.
    import {onMount} from "svelte";
    import * as d3 from "d3";
    //https://github.com/PAIR-code/understanding-umap/blob/master/src/shared/js/generators.js

    // Gaussian generator, mean = 0, std = 1.
    var normal = d3.randomNormal();

    // Create random Gaussian vector.
    export function normalVector(dim) {
        var p = [];
        for (var j = 0; j < dim; j++) {
            p[j] = normal();
        }
        return p;
    }

    // A point with color info.
    export class Point {
        constructor(coords) {
            this.coords = coords;
        }
    }

    export function nClustersData(n, dim, number) {
        dim = dim || 50;
        var points = [];
        let offset = [];
        while (offset.length < number) {
            let rnd = d3.randomInt(0, 100)();
            if (offset.indexOf(rnd) === -1) {
                offset.push(rnd)
            }
        }
        for (var i = 0; i < n; i++) {
            for (var j = 0; j < number; j++) {
                var p1 = normalVector(dim);
                p1[0] += offset[j];
                points.push(new Point(p1));
            }
        }
        return points;
    }

    // Data in a rough simplex.
    export function simplexData(n, noise) {
        noise = noise || 0.5;
        var points = [];
        for (var i = 0; i < n; i++) {
            var p = [];
            for (var j = 0; j < n; j++) {
                p[j] = i === j ? 1 + noise * normal() : 0;
            }
            points.push(new Point(p));
        }
        return points;
    }

    // Data in a 2D circle, regularly spaced.
    export function circleData(numPoints) {
        var points = [];
        for (var i = 0; i < numPoints; i++) {
            var t = (2 * Math.PI * i) / numPoints;
            points.push(new Point([Math.cos(t), Math.sin(t)]));
        }
        return points;
    }

    onMount(() => {
        // let points = nClustersData(1, 2, 5)
        // let pointsCircle = circleData(5)
        // let pointsSimplex = simplexData(5)
    });

</script>
