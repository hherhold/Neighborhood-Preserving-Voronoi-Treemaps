<script>
    import {similarityStore} from "../store";
    export let nodeID;
    export let positions;
    let pairSameArray = [$similarityStore[nodeID].initializationFinished[0]];
</script>

{#if pairSameArray !== undefined && pairSameArray.length > 0}
    {#each pairSameArray as pairSame, i}
        <line x1="{positions[nodeID][0]}" y1="{positions[nodeID][1]}" x2="{positions[pairSame[0]][0]}"
              y2="{positions[pairSame[0]][1]}" stroke="black" stroke-width="5"/>
        <g transform="translate({(positions[nodeID][0]+positions[pairSame[0]][0])/2},{(positions[nodeID][1]+positions[pairSame[0]][1])/2})">
            <text>{Math.round(pairSame[1] * 1e2) / 1e2}</text>
        </g>
    {/each}
{/if}
