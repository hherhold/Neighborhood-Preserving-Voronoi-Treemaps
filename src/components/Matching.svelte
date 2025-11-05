<script>
    import {computeMunkres} from "../external/munkres.js";
    import {euclideanDist} from "../helpers/helpers";
    import {
        dict, initializationStrategies,
        matchingDone,
        matchingStore,
        matchingStoreString,
        projectionStoreDepth,
        selectedInitializationStrategyID,
        shouldShuffle,
        voronoiStore,
        voronoiStoreIDRoot
    } from "../store";

    export let nodes = []
    export let depth = -1

    let width = 640;
    let height = 640;

    let sites = [];
    let cellList = [];


    $: if (
        nodes.length > 0
        && $projectionStoreDepth.hasOwnProperty(depth + 1)
        && $voronoiStore.hasOwnProperty(depth)
        && !$matchingStore.hasOwnProperty(depth + 1)
        && $voronoiStoreIDRoot.hasOwnProperty(nodes[0].parent.data.id)
    ) {
        console.log("Start Voronoi Matching");
        sites = [];
        cellList = [];
        //calculate matching
        //get positions of the voronoicells
        let positions = [];
        $voronoiStore[depth].map((d) => {
            positions.push({
                id: d.originalObject.data.originalData.data.id,
                position: [d.x, d.y],
                parent: d.originalObject.data.originalData.data.parent,
            })
        })
        //row is one position
        //column is the distance to other positions
        let arrayEuclideanDistance = []
        for (let i = 0; i < positions.length; i++) {
            let distancesCurrent = []
            let parentVoronoiCell = positions[i].parent;
            for (let j = 0; j < $projectionStoreDepth[depth + 1].length; j++) {
                //It minimizes the distance between the projection and Voronoi Cells
                //However, only cells that have the correct parent are a possibility
                //Therefore, we set all other to very large distance
                let parentProjection = nodes[j].parent.data.id;
                if (parentVoronoiCell === parentProjection) {
                    distancesCurrent.push(euclideanDist(positions[i].position, $projectionStoreDepth[depth + 1][j]))
                } else {
                    distancesCurrent.push(1000000)
                }
            }
            arrayEuclideanDistance.push(distancesCurrent)
        }
        //Returns an array where the first element is the row and the second element is the column
        let highdimAssign = computeMunkres(arrayEuclideanDistance)

        let matchingList = []
        console.log("is shuffling: " + $shouldShuffle);
        if ($shouldShuffle) {
            console.log("Shuffling...")
            //https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
            positions = positions
                .map(value => ({value, sort: Math.random()}))
                .sort((a, b) => a.sort - b.sort)
                .map(({value}) => value)
            console.log("ids after shuffle")
            console.log(positions)
            console.log("///nodes///")
            console.log("ids before shuffle")
            console.log(nodes)
            //https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
            nodes = nodes
                .map(value => ({value, sort: Math.random()}))
                .sort((a, b) => a.sort - b.sort)
                .map(({value}) => value)
        }
        for (let i = 0; i < highdimAssign.length; i++) {
            let obj = {
                voronoiID: positions[highdimAssign[i][0]].id,
                projectionID: nodes[highdimAssign[i][1]].data.id,
            }
            //Use random instead of mukres
            if ($initializationStrategies[$selectedInitializationStrategyID].name === 'random'
                || $initializationStrategies[$selectedInitializationStrategyID].name === 'pie') {
                $dict[nodes[highdimAssign[i][1]].data.id].voronoiID = positions[i].id
                $matchingStoreString[positions[highdimAssign[i][0]].id] = nodes[i].data.id
            }
            $dict[nodes[highdimAssign[i][1]].data.id].voronoiID = positions[highdimAssign[i][0]].id
            nodes[highdimAssign[i][1]].voronoiID = positions[highdimAssign[i][0]].id//left:Projection right: assigned position
            $matchingStoreString[positions[highdimAssign[i][0]].id] = nodes[highdimAssign[i][1]].data.id //left: positionID right:projectionID
            matchingList.push(obj)
        }
        $matchingStore[depth + 1] = matchingList;
        matchingStore.set($matchingStore);
        matchingDone.set(true);
        console.log("Voronoi Matching Finished for rank" + " " + depth);
    }
</script>

