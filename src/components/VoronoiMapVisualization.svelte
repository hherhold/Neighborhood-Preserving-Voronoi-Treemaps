<script>
    import * as d3 from "d3";

    export let polygons = [];

</script>
{#if polygons.length > 0}
    {#each polygons as polygon}
        <path d="{d3.line()(polygon) + 'z'}" stroke="rgb(255, 0, 0)" stroke-width="5px" fill="none"/>
        <circle cx="{polygon.site.centroid[0]}" cy="{polygon.site.centroid[1]}" r="5px"/>
        <g transform="translate({polygon.site.centroid[0]},{polygon.site.centroid[1]})">
            <text>{polygon.site.originalObject.data.originalData.data.id}</text>
        </g>
    {/each}
{/if}
