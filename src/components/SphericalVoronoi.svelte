<script>
    /**
     * SphericalVoronoi.svelte
     *
     * Renders a natively spherical Voronoi tessellation of the leaf nodes from
     * the computed Voronoi Treemap, using d3-geo-voronoi on the surface of a
     * unit sphere projected with an interactive orthographic (globe) projection.
     *
     * Each leaf node's 2D centroid from the flat Voronoi layout is mapped to
     * [longitude, latitude] coordinates, preserving the spatial neighbourhood
     * structure established by the flat treemap optimisation.  The globe can
     * be rotated by click-dragging.
     */
    import * as d3 from 'd3';
    import { geoVoronoi } from 'd3-geo-voronoi';
    import { finalPolygons, dict, queueGroupFinished } from '../store';

    export let width  = 600;
    export let height = 600;

    // ── Computed spherical Voronoi data (rebuilt when polygons are ready) ────
    let polygonFeatures = [];
    let pointFeatures   = [];
    let hoveredId       = null;

    // ── Globe rotation state (lon, lat) ─────────────────────────────────────
    let rotate    = [0, -20];
    let dragging  = false;
    let lastMouse = null;
    const SENSITIVITY = 0.3;

    // Graticule is static
    const graticuleFeature = d3.geoGraticule()();

    // ── Reactive sizing ──────────────────────────────────────────────────────
    $: radius = (Math.min(width, height) / 2) - 10;
    $: cx     = width  / 2;
    $: cy     = height / 2;

    // ── Projection + path generator (both react to rotate & size) ───────────
    $: projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate(rotate)
        .clipAngle(90);

    $: pathGen       = d3.geoPath().projection(projection);
    $: spherePath    = pathGen({ type: 'Sphere' });
    $: graticulePath = pathGen(graticuleFeature);

    // ── Rebuild spherical Voronoi when flat layout is complete ───────────────
    $: if (
        $queueGroupFinished.length > 0 &&
        $queueGroupFinished.every(Boolean) &&
        $finalPolygons.length > 0
    ) {
        buildSphericalVoronoi($finalPolygons);
    }

    function buildSphericalVoronoi(polygons) {
        // Only consider leaf nodes (height === 0 in d3-hierarchy)
        const leaves = polygons.filter(p =>
            p?.polygon?.site?.originalObject?.data?.originalData?.height === 0 &&
            Array.isArray(p?.polygon?.site?.centroid)
        );
        if (leaves.length < 4) return;

        // Map each leaf's flat-Voronoi centroid to [lon, lat] on the sphere.
        // We preserve the relative spatial layout from the 2D optimisation so
        // that neighbourhood relationships are reflected on the sphere surface.
        const xs = leaves.map(p => p.polygon.site.centroid[0]);
        const ys = leaves.map(p => p.polygon.site.centroid[1]);
        const lonScale = d3.scaleLinear()
            .domain([Math.min(...xs), Math.max(...xs)])
            .range([-165, 165]);
        const latScale = d3.scaleLinear()
            .domain([Math.min(...ys), Math.max(...ys)])
            .range([75, -75]);   // flip y: SVG origin is top-left

        const fc = {
            type: 'FeatureCollection',
            features: leaves.map(p => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [
                        lonScale(p.polygon.site.centroid[0]),
                        latScale(p.polygon.site.centroid[1])
                    ]
                },
                properties: {
                    id:    p.polygon.site.id,
                    color: p.polygon.site.originalObject.data.originalData.data?.color ?? '#888',
                    name:  getDisplayName(p.polygon.site.id)
                }
            }))
        };

        try {
            const v = geoVoronoi(fc);
            const polys = v.polygons();
            polygonFeatures = (polys && polys.features) ? polys.features : [];
            pointFeatures   = fc.features;
        } catch (err) {
            console.warn('Spherical Voronoi construction failed:', err);
            polygonFeatures = [];
            pointFeatures   = [];
        }
    }

    function getDisplayName(id) {
        const node = $dict[id];
        if (!node) return id;
        return node.data?.name ?? node.data?.id ?? id;
    }

    // ── Drag-to-rotate mouse handlers ────────────────────────────────────────
    function onMouseDown(e) {
        dragging  = true;
        lastMouse = [e.clientX, e.clientY];
        e.preventDefault();
    }
    function onMouseMove(e) {
        if (!dragging || !lastMouse) return;
        const dx = e.clientX - lastMouse[0];
        const dy = e.clientY - lastMouse[1];
        rotate    = [rotate[0] + dx * SENSITIVITY, rotate[1] - dy * SENSITIVITY];
        lastMouse = [e.clientX, e.clientY];
    }
    function onMouseUp() {
        dragging  = false;
        lastMouse = null;
    }

    // ── Touch handlers (mobile / tablet) ────────────────────────────────────
    function onTouchStart(e) {
        if (e.touches.length === 1) {
            dragging  = true;
            lastMouse = [e.touches[0].clientX, e.touches[0].clientY];
        }
    }
    function onTouchMove(e) {
        if (!dragging || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - lastMouse[0];
        const dy = e.touches[0].clientY - lastMouse[1];
        rotate    = [rotate[0] + dx * SENSITIVITY, rotate[1] - dy * SENSITIVITY];
        lastMouse = [e.touches[0].clientX, e.touches[0].clientY];
    }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="inline-block select-none">
    <svg
        {width}
        {height}
        on:mousedown={onMouseDown}
        on:mousemove={onMouseMove}
        on:mouseup={onMouseUp}
        on:mouseleave={onMouseUp}
        on:touchstart|passive={onTouchStart}
        on:touchmove|passive={onTouchMove}
        on:touchend={onMouseUp}
        style="cursor: {dragging ? 'grabbing' : 'grab'}"
    >
        <!-- Ocean background -->
        <path d={spherePath} fill="#c9e8f5" />

        <!-- Graticule (lat/lon grid lines) -->
        <path d={graticulePath} stroke="#b0c8d8" stroke-width="0.4" fill="none" />

        <!-- Spherical Voronoi cells -->
        {#each polygonFeatures as feature}
            {@const id    = feature.properties?.site?.properties?.id}
            {@const color = feature.properties?.site?.properties?.color ?? '#aaa'}
            {@const name  = feature.properties?.site?.properties?.name  ?? id}
            <path
                d={pathGen(feature)}
                fill={color}
                stroke="#333"
                stroke-width="0.6"
                opacity={hoveredId === id ? 1.0 : 0.82}
                on:mouseenter={() => hoveredId = id}
                on:mouseleave={() => hoveredId = null}
            >
                <title>{name}</title>
            </path>
        {/each}

        <!-- Generator points (one per leaf node) -->
        {#each pointFeatures as pt}
            {@const proj = projection(pt.geometry.coordinates)}
            {#if proj}
                <circle cx={proj[0]} cy={proj[1]} r="2.5" fill="#111" opacity="0.7" pointer-events="none" />
            {/if}
        {/each}

        <!-- Hover label -->
        {#if hoveredId !== null}
            {@const feat = polygonFeatures.find(f => f.properties?.site?.properties?.id === hoveredId)}
            {#if feat}
                {@const ct = pathGen.centroid(feat)}
                {#if ct && !isNaN(ct[0])}
                    <text
                        x={ct[0]}
                        y={ct[1]}
                        text-anchor="middle"
                        dominant-baseline="middle"
                        font-size="12"
                        font-weight="600"
                        stroke="white"
                        stroke-width="3"
                        paint-order="stroke"
                        pointer-events="none"
                    >
                        {feat.properties?.site?.properties?.name ?? hoveredId}
                    </text>
                {/if}
            {/if}
        {/if}

        <!-- Globe border -->
        <path d={spherePath} fill="none" stroke="#556" stroke-width="1.5" />
    </svg>

    <p class="text-sm text-gray-400 mt-1">Click and drag to rotate the globe.</p>
</div>
