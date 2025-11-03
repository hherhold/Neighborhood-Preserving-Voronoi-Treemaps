<script>
    import DataImporter from "./components/DataImporter.svelte";
    import VoronoiTreemapKnarf from "./components/VoronoiTreemapKnarf.svelte";
    // import ImageExporter from "./components/ImageExporter.svelte";
</script>

<main>
    <h1 class="h1 my-30">Neighborhood-Preserving Voronoi Treemaps</h1>
    <DataImporter></DataImporter>
    <!--	<Matching></Matching>-->
    <!--	<VoronoiTreeMapComponent></VoronoiTreeMapComponent>-->
    <VoronoiTreemapKnarf></VoronoiTreemapKnarf>
    <!--  <ImageExporter/>-->
</main>

<svelte:head>
    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,600,700" rel="stylesheet">

    <!-- Material Typography -->
    <link href="https://unpkg.com/@material/typography@14.0.0/dist/mdc.typography.css" rel="stylesheet"/>

    <!-- SMUI -->
    <link href="https://cdn.jsdelivr.net/npm/svelte-material-ui@7.0.0/themes/svelte.min.css" rel="stylesheet"/>
</svelte:head>

