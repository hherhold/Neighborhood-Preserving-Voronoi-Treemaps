<script>

    import {
        dict,
        matchingStore,
        pairLinks,
        voronoiStoreID,
        voronoiStoreIDRoot,
        voronoiStoreOptimized,
    } from "../store";

    export let root = {};
    export let depth
    let pairPositions = [];
    $:if (
        root.hasOwnProperty('children')
        && !$voronoiStoreOptimized.hasOwnProperty(root.data.id)
        && $voronoiStoreIDRoot.hasOwnProperty(root.data.id)
        && $matchingStore.hasOwnProperty(root.depth + 1)
    ) {
        root.children.map(d => {
            let obj = $dict[d.data.id];
            if ('voronoiID' in obj) {
                d.data.initialPos = $voronoiStoreID[obj.voronoiID]
            } else {
                console.log("error")
            }
        })
        root.children.sort((a, b) => a.voronoiID - b.voronoiID);
        console.log("finished creating the matched Voronoi Map")
    }
    $:if ($pairLinks && pairPositions.length === 0 && $pairLinks.length > 0 && $matchingStore.hasOwnProperty(root.depth + 1) && $voronoiStoreID) {
        if (pairPositions.length === 0) {
            for (let i = 0; i < $pairLinks.length; i++) {
                let child = $matchingStore[root.depth + 1].find(d => d.projectionID === $pairLinks[i][0]);//Object.values($voronoiStoreID).find(d => d.originalObject.data.originalData.data.id === $pairLinks[i][0])
                let target = $matchingStore[root.depth + 1].find(d => d.projectionID === $pairLinks[i][1][0]) //.find(d => d.originalObject.data.originalData.data.id === $pairLinks[i][1][0])
                if (child !== undefined && target !== undefined) {
                    pairPositions.push([
                        [$voronoiStoreID[child.voronoiID].centroid[0], $voronoiStoreID[child.voronoiID].centroid[1]],
                        [$voronoiStoreID[target.voronoiID].centroid[0], $voronoiStoreID[target.voronoiID].centroid[1]]
                    ])
                }
            }
        }
        pairPositions = pairPositions
    }
</script>
