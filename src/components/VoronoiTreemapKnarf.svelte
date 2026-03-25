<script>

    import {
        attractionLinksPercentage,
        attractionLinksPreservedTotal,
        attractionLinksTotal,
        averageBoundingBoxAspectRatio,
        averageConverganceRate,
        clippingPolygonOuter,
        counter,
        dataStore,
        dict,
        initializationStrategies,
        loadedDataset,
        matchingStore,
        matchingStoreString,
        offsetStroke,
        queueGrouped,
        queueGroupedBaselineClone,
        queueGroupFinished,
        selectedInitializationStrategyID,
        simAttribute,
        similarityMeasure,
        similarityMeasureDict,
        similarityStore,
        useInternalEmbeddings,
        useNeighborLeafs,
        visualizationWidth,
        voronoiStoreIDOptimized,
        voronoiStoreIDOptimizedBaseline,
        weightAttribute
    } from "../store";
    import {cumSum, groupBy, median} from "../helpers/helpers";
    import VoronoiMapKnarf from "./VoronoiMapKnarf.svelte";
    import Projection from "./Projection.svelte";
    import Matching from "./Matching.svelte";
    import VoronoiMapKnarfMatched from "./VoronoiMapKnarfMatched.svelte";
    import FinalTreeMap from "./FinalTreeMap.svelte";
    import ProjectionAll from "./ProjectionAll.svelte";
    import SyntheticDataGenerator from "./SyntheticDataGenerator.svelte";
    import VoronoiMapQueue from "./VoronoiMapQueue.svelte";
    import {apply, concat, matrix, mean} from 'mathjs'
    import * as d3 from "d3";
    import DataTable, {Body, Cell, Head, Row} from "@smui/data-table";
    import VoronoiMapQueueBaseLine from "./VoronoiMapQueueBaseline.svelte";

    let width = window.innerWidth / 5;
    visualizationWidth.set(window.innerWidth / 5)
    let height = window.innerWidth / 5;
    let n_sides = 32;
    let clippingPolygon = []
    let radius = width / 2;
    let origin = [(width / 2) + $offsetStroke, height / 2 + $offsetStroke]
    let columnCount = 6

    let queue = []
    let nodesArray = []


    function weightAccessor(d) {
        if (d.hasOwnProperty('isArtificial')) {
            return 0;
        }
        return d.weight; // computes the weight of one of your data; depending on your data, it may be 'd.area', or 'd.percentage', ...
    }

    $:if ($loadedDataset) {
        width = (window.innerWidth - 128) / 4;
        height = (window.innerWidth - 128) / 4;
        if ($initializationStrategies[$selectedInitializationStrategyID].name === 'projectionMapping') {
            columnCount = 8
            width = (window.innerWidth - 128) / 4;
            height = (window.innerWidth - 128) / 4;
        } else if ($initializationStrategies[$selectedInitializationStrategyID].name === 'force') {
            columnCount = 8
            width = (window.innerWidth - 128) / 4;
            height = (window.innerWidth - 128) / 4;
        }
        queue = []
        nodesArray = []
        computeVoronoiTreemap()
    }

    function computeVoronoiTreemap() {
        let n_angles = 2 * Math.PI / n_sides;
        for (let i = 0; i < n_sides; i++) {
            clippingPolygon.push(
                [origin[0] + radius * Math.cos(i * n_angles), origin[1] + radius * Math.sin(i * n_angles)])
        }
        clippingPolygonOuter.set(clippingPolygon)
        if ($weightAttribute === "none") {
            $dataStore.each(d => d.data.weight = 1)
            weightAttribute.set('weight')
        } else {
            $dataStore.each(d => d.data.weight = d.data[$weightAttribute])
        }
        // assigns the adequate weight to each node of the d3-hierarchy
        //Do the same for the embeddings
        $dataStore.voronoiID = 0;
        queue = []
        let tempDict = {}
        let maxDepth = 0
        $dataStore.each(d => {
            if (d.depth > maxDepth) {
                maxDepth = d.depth
            }
            if (d.data.hasOwnProperty('embeddings') && d.data['embeddings'].length === 1 && d.data['embeddings'][0].length > 1) {
                d.data['embeddings'] = d.data['embeddings'][0]
            }
        })
        $dataStore.each(d => {
            //If we do not have the same height across the dataset, we artificially move nodes downwards
            if (d.depth < maxDepth && d.height === 0) {
                let parentCopy = d
                for (let currDepth = d.depth; currDepth < maxDepth; currDepth++) {
                    //put itself as child

                    let dCopy = {
                        id: parentCopy.data.id + "depth" + parentCopy.depth,
                        embeddings: parentCopy.data[$simAttribute],
                        weight: 0,
                        name: parentCopy.data.id,
                        isArtificial: true,
                        originalDepth: parentCopy.depth
                    }
                    let newNode = d3.hierarchy(dCopy);
                    if (parentCopy.data.hasOwnProperty("name")) {
                        newNode.data.name = parentCopy.data.name
                    }
                    if (parentCopy.data.hasOwnProperty("centroid")) {
                        newNode.data.centroid = parentCopy.data.centroid
                    }
                    newNode.parent = parentCopy;
                    newNode.id = parentCopy.data.id + "depth" + parentCopy.depth;
                    newNode.depth = parentCopy.depth + 1;
                    newNode.embeddings = parentCopy.data.embeddings
                    newNode.height = 0;

                    parentCopy.children = [newNode]
                    parentCopy.data.children = [newNode]
                    delete parentCopy.data[$simAttribute]
                    parentCopy.height = 1
                    parentCopy = newNode

                    for (let height = 1, anc = d; anc != null; height++, anc = anc.parent) {
                        anc.height = Math.max(anc.height, height);
                    }
                }
            }
        })
        $dataStore.each(d => {
            queue.push(d)
            tempDict[d.data.id] = d
        })
        $dataStore.sum(weightAccessor);
        dict.set(tempDict)
        nodesArray = Object.values($dict)

        $queueGrouped = groupBy(queue, 'depth')
        $queueGroupedBaselineClone = structuredClone($queueGrouped)
        $queueGroupFinished = new Array($queueGrouped.length - 1).fill(false)

        $dataStore.eachAfter(d => {
            // If it has children
            if (!d.data.hasOwnProperty($simAttribute) && $useInternalEmbeddings) {
                let avgArray;
                for (let i = 0; i < d.data.children.length; i++) {
                    let child = d.data.children[i];
                    if (i === 0) {
                        avgArray = matrix([child[$simAttribute]])
                    } else {
                        avgArray = concat(avgArray, matrix([child[$simAttribute]]), 0);
                    }
                }
                //TODO do averaging here
                avgArray = apply(avgArray, 0, mean).toArray()
                d.data[$simAttribute] = avgArray
            }
        })
        $dataStore.eachAfter(d => {
                if (d.data.hasOwnProperty("children") && $queueGrouped[d.depth + 1] !== undefined) {
                    d.data['constraintsFromChildren'] = []
                    //calculate similarities between all nodes on the current rank once
                    let nodesCurrRank = $queueGrouped[d.depth + 1]
                    //Loop over all children
                    for (let i = 0; i < d.data.children.length; i++) {
                        let child = d.data.children[i]
                        let iID = child.id;
                        if (iID === "MergeEdge") {
                            console.log("undefined")
                        }
                        d.children[i].data['constraintsFromChildren'] = []
                        //For each child, get all
                        if ($similarityStore[iID] === undefined) {
                            console.log("error")
                        }
                        $similarityStore[iID]['unsorted'] = {}
                        $similarityStore[iID]['diffParent'] = {}
                        $similarityStore[iID]['sameParent'] = {}
                        for (let j = 0; j < nodesCurrRank.length; j++) {
                            let jID = nodesCurrRank[j].data.id;
                            if (iID !== jID) {
                                if (child.hasOwnProperty($simAttribute) && nodesCurrRank[j].data.hasOwnProperty($simAttribute)) {
                                    //Use the correct similarity function
                                    let sim = $similarityMeasureDict[$similarityMeasure](child[$simAttribute], nodesCurrRank[j].data[$simAttribute]);
                                    if ($useNeighborLeafs) {
                                        if ("neighbors" in child && child.neighbors.includes(nodesCurrRank[j].data.id)) {
                                            sim = 1
                                        } else {
                                            sim = 0
                                        }
                                    }
                                    $similarityStore[iID]['unsorted'][jID] = sim
                                    if (d.data.id !== nodesCurrRank[j].parent.data.id) {
                                        $similarityStore[iID]['diffParent'][jID] = sim
                                    } else {
                                        $similarityStore[iID]['sameParent'][jID] = sim
                                    }
                                } else {
                                    console.log("No similarity")
                                }
                            }
                        }
                        //sort data whole rank
                        $similarityStore[iID].sortedListWholeRank = Object.keys($similarityStore[iID]['unsorted']).map(function (key) {
                            return [key, $similarityStore[iID]['unsorted'][key]];
                        });
                        $similarityStore[iID].sortedListWholeRank.sort(function (first, second) {
                            return second[1] - first[1];
                        });
                        //sort data same parent
                        $similarityStore[iID].sortedListSameParent = Object.keys($similarityStore[iID]['sameParent']).map(function (key) {
                            return [key, $similarityStore[iID]['sameParent'][key]];
                        });
                        $similarityStore[iID].medSameParent = median(Object.values($similarityStore[iID]['sameParent']))
                        $similarityStore[iID].sortedListSameParent.sort(function (first, second) {
                            return second[1] - first[1];
                        });
                        //sort data different parent
                        $similarityStore[iID].sortedListDiffParent = Object.keys($similarityStore[iID]['diffParent']).map(function (key) {
                            return [key, $similarityStore[iID]['diffParent'][key]];
                        });
                        $similarityStore[iID].sortedListDiffParent.sort(function (first, second) {
                            return second[1] - first[1];
                        });
                        $similarityStore[iID].sortedListDiffParentParent = $similarityStore[iID].sortedListDiffParent.map(k => {
                            return [$dict[k[0]].parent.data.id, k[1]]
                        })
                    }
                    //Now that all child sim are stored, we have to look at them and add constraints to the current d node
                    $similarityStore[d.data.id] = {}
                    $similarityStore[d.data.id].constraintsFromChildren = d.data.constraintsFromChildren
                    d.data.pairDiff = -1
                    $similarityStore[d.data.id].pairDiff = -1
                } else {
                    if (!$similarityStore.hasOwnProperty(d.data.id)) {
                        $similarityStore[d.data.id] = {}
                        $similarityStore[d.data.id].pairDiff = -1
                        $similarityStore[d.data.id].pairSame = -1
                        $similarityStore[d.data.id].constraintsFromChildren = []
                        d.data.constraintsFromChildren = []
                        d.data.pairDiff = -1
                        d.data.pairSame = -1
                    }
                }
            }
        );
        let bucketRank = {}
        Object.keys($similarityStore).forEach((d, i) => {
            let nodeValue = $similarityStore[d]
            if (nodeValue.sortedListWholeRank !== undefined
                && !nodeValue.sortedListWholeRank.some(e => e[1] === undefined && e[0] === undefined)) {
                //if we have embeddings in our data, we group them into quantiles for each datapoint
                //bins
                let thres = function (data, min, max) {
                    return d3.range(5).map(t => min + (t / 5) * (max - min))
                }
                const bin = d3
                    .bin()
                    .value((d) => d[1])
                    .thresholds(thres);

                //Should before round the values in the range 0 to 100
                let bucketsNormalized = bin(nodeValue.sortedListWholeRank.map(e => [e[0], Math.floor(e[1] * 100)])).reverse()
                if (bucketsNormalized[0][0] === undefined) {
                    console.log("Found None in the Buckets")
                }
                // let firstElement = bucketsNormalized[0][0]
                // if (false) {
                //     let rest = bucketsNormalized[0].slice(1)
                //     bucketsNormalized.splice(0, 1, rest)
                //     bucketsNormalized = [[firstElement], ...bucketsNormalized]
                // }
                if ($useNeighborLeafs) {
                    bucketsNormalized = [[...nodeValue.constraintsFromChildren.map(e => [e[0], Math.floor(e[1] * 100)]), ...nodeValue.sortedListWholeRank.map(e => [e[0], Math.floor(e[1] * 100)]).filter(d => d[1] > 0)]]

                }
                nodeValue.simBuckets = bucketsNormalized
                // If the first bucket has similarity of 0, we do not add any constraints and skip
                if (bucketsNormalized[0].length > 0 && bucketsNormalized[0][0][1] === 0) {
                    //Do not add anything
                    return
                }

                //Instead of binning use cumsum
                // Calculate change points using cumsum

                //All sim across the border should be aggregated per parent, as it will be a single edge
                //All similarities inside
                let cpArray = Array(nodeValue.sortedListSameParent.length).fill(false)
                cumSum(nodeValue.sortedListSameParent, cpArray)
                if (nodeValue.sortedListSameParent.length > 10) {
                    cumSum(nodeValue.sortedListSameParent, cpArray)
                }
                nodeValue.cpChangePoints = cpArray
                let curr_is = Object.keys($similarityStore)[i]
                for (let k = 0; k < bucketsNormalized.length; k++) {
                    for (let constr of bucketsNormalized[k]) {
                        //Check if bucket constraint is already in another bucket
                        if (constr[0] + curr_is in bucketRank && k === bucketRank[constr[0] + curr_is]) {
                            //We have to check if it has the same rank
                        } else if (constr[0] + curr_is in bucketRank && bucketRank[constr[0] + curr_is] !== k) {
                            //Swap the first and second element

                        } else {
                            bucketRank[curr_is + constr[0]] = k
                        }
                    }
                }


                //we save the buckets to each node
                //each constraint in the bucket is either contrained or not
                //isFulfilled
                //If is in first bucket
                //has to become direkt neighbour
                //If not first bucket
                //check if one of the neighbours has a constraint with the same target that is fullfilled and in the same or higher bucket
                // If yes, the node is fine --> moveTowards
                //If no, we have to move towards the contstraint
                // If the target node
                nodeValue.constraintsFromChildren = nodeValue.simBuckets[0].slice(0, 6)
            }
        })
        $dataStore.eachAfter(d => {
            if(d.hasOwnProperty("children") && d.height !== 0){
                for (let p = 0; p < d.children.length; p++) {
                    let child = $similarityStore[d.children[p].data.id]
                    if(child.constraintsFromChildren.length > 0){
                        for (let c = 0; c < child.constraintsFromChildren.length; c++) {
                            let constraintChild = child.constraintsFromChildren[c]
                            let parent = $queueGrouped[d.depth+1].filter(e => e.data.id === constraintChild[0])[0].parent
                            let hasConstraint = $similarityStore[d.data.id].constraintsFromChildren.filter(e => e[0] === parent.data.id).length
                            if(parent.data.id !== d.data.id && hasConstraint === 0){
                                if(constraintChild[1] === 100){
                                    $similarityStore[d.data.id].constraintsFromChildren.push([parent.data.id, constraintChild[1]])
                                } else if($similarityStore[d.data.id].constraintsFromChildren.length < 1){
                                    $similarityStore[d.data.id].constraintsFromChildren.push([parent.data.id, constraintChild[1]])
                                }
                            }
                        }
                    }
                }
            }
            d.data.constraintsFromChildren = $similarityStore[d.data.id].constraintsFromChildren
        })
        queue[0].clippingPolygon = clippingPolygon;
        queue[0].site = {x: width / 2, y: height / 2};

        $matchingStore[0] = [{
            voronoiID: 0,
            projectionID: 0
        }]
        // $voronoiStoreID[25] =  {x:width/2, y:height/2}
        $voronoiStoreIDOptimized[queue[0].data.id] = {polygon: clippingPolygon}
        $voronoiStoreIDOptimizedBaseline[queue[0].data.id] = {polygon: clippingPolygon}
        $matchingStoreString[0] = queue[0].data.id
        counter.increment();

        //const colors = ["#4379AB", "#96CCEB", "#FF8900", "#FFBC71", "#3DA443", "#76D472", "#BA9900", "#F7CD4B", "#249A95", "#77BEB6", "#F14A54", "#FF9797", "#7B706E", "#BCB0AB", "#E16A96", "#FFBCD3", "#B976A3", "#DCA3CA", "#A3745C", "#DDB3A4"]
        const colors = ["#7fc97f", "#beaed4", "#fdc086", "#ffff99", "#386cb0", "#f0027f", "#bf5b17", "#666666"]

        const leafnodenames = [...new Set($queueGrouped[$queueGrouped.length - 1].flat().map((d) => d.data.name || undefined))]
        if (!leafnodenames.some((d) => d === undefined)) {
            let colordict = {}
            for (const [i, value] of leafnodenames.entries()) {
                colordict[value] = colors[i]
            }
            for (const node of $queueGrouped[$queueGrouped.length - 1].flat()) {
                if (node.data.hasOwnProperty('name')) {
                    node.data.color = colordict[node.data.name]
                } else {
                    node.data.color = colordict[node.data.id]
                }
            }
        }
    }
</script>

<SyntheticDataGenerator></SyntheticDataGenerator>
<h2 class="h2 mt-6">Dataset Information</h2>
<DataTable class="mt-6 max-w-fit " style="max-height: inherit;">
    <Head>
        <Row>
            <Cell>Hierachy Levels</Cell>
            <Cell>#Nodes</Cell>
            <Cell>#Leaf Nodes</Cell>
            <Cell>#Constraints</Cell>
            <!--            <Cell>#Constraints Baseline preserved</Cell>-->
            <!--            <Cell>%Constraints Baseline preserved</Cell>-->
            <Cell>#Constraints preserved</Cell>
            <Cell>%Constraints preserved</Cell>
            <Cell>Avg. BB Aspect Ratio</Cell>
            <Cell>Avg. Convergence Ratio</Cell>

        </Row>
    </Head>
    <Body>
    <Row>
        <Cell>
            {$queueGrouped.length}
        </Cell>
        <Cell>
            {nodesArray.length}
        </Cell>
        <Cell>
            {nodesArray.filter(d => d.height === 0).length}
        </Cell>
        <Cell>
            {#if $attractionLinksTotal.length > 0}
                {$attractionLinksTotal.length}
            {/if}
        </Cell>
        <Cell>
            {$attractionLinksPreservedTotal}
        </Cell>
        <Cell>
            {$attractionLinksPercentage}
        </Cell>
        <Cell>
            {$averageBoundingBoxAspectRatio}
        </Cell>
        <Cell>
            {$averageConverganceRate}
        </Cell>
    </Row>
    </Body>
</DataTable>
<div class="grid grid-cols-{columnCount} divide-x divide-y">
    <div class="col-span-2">
        <h2 class="h2 cols-start-2 py-10">PCA Projection of all Datapoints</h2>
        <ProjectionAll height="{height}" nodes="{nodesArray}" width="{width}"></ProjectionAll>
    </div>
    <div class="col-span-3">
        <h2 class="h2 cols-start-2 py-6">Final Voronoi Treemap Visualization</h2>
        {#if $queueGroupFinished.every(d => d)}
            <FinalTreeMap height="{height}" width="{width}"></FinalTreeMap>
        {/if}
    </div>
    {#each $queueGrouped as voronoiParents, i}
        {#if i < $queueGrouped.length - 1 }
            <div class="py-5 grid grid-cols-subgrid col-span-6">
                <h2 class="h2 cols-start-2">Layer {i}</h2>
            </div>
            <!--        Calculate projection per depth-->
            {#if $initializationStrategies[$selectedInitializationStrategyID].name === 'projectionMapping'}
                <div class="col-span-2 projection rank{i+1}" id="projectionRank{i+1}">
                    <h2 class="content-center h2 py-6">Projection</h2>
                    <Projection nodes="{$queueGrouped[i+1].flat()}" depth="{i}" width="{width}"
                                height="{height/2}"></Projection>
                </div>
            {/if}
            {#if $initializationStrategies[$selectedInitializationStrategyID].name !== 'projectionMapping'}
                <div class="projection rank{i+1}" id="projectionRank{i+1}hidden" hidden>
                    <Projection nodes="{$queueGrouped[i+1].flat()}" depth="{i}" width="{width}"
                                height="{height/2}"></Projection>
                </div>
            {/if}
            <!--        Optimize matched positions per depth-->
            <div class="voronoiMapEquidistant rank{i+1}" id="equidistantRank{i+1}" hidden>
                <div hidden>
                    <svg id="voronoiEqui">
                        {#each voronoiParents as node}
                            <VoronoiMapKnarf root="{node}" depth="{i}"></VoronoiMapKnarf>
                        {/each}
                    </svg>
                </div>
                <!--        Calculate matching per depth-->
                <Matching nodes="{$queueGrouped[i+1].flat()}" depth="{i}"></Matching>
                <svg col-span-1 width="{width}" height="{height}" id="matched">
                    {#each voronoiParents as nodeOptimized, j}
                        <VoronoiMapKnarfMatched root="{nodeOptimized}" depth="{i}"></VoronoiMapKnarfMatched>
                    {/each}
                </svg>
            </div>
            {#if $queueGroupedBaselineClone[i] && $queueGroupedBaselineClone[i].length > 0}
                <div class="col-span-2" id="baselineRank{i+1}" hidden>
                    <!--                    <h2 class="content-center h2 py-6">Baseline</h2>-->
                    <svg col-span-1 width="{width+$offsetStroke}" height="{height+$offsetStroke}" id="baseline">
                        <VoronoiMapQueueBaseLine voronoiParents="{$queueGroupedBaselineClone[i]}" i="{i+100}"
                                                 width="{width}"
                                                 height="{height}"></VoronoiMapQueueBaseLine>
                    </svg>
                </div>
            {/if}
            <div class="col-span-6 py-6">
                <VoronoiMapQueue nodes="{$queueGrouped[i+1].flat()}" voronoiParents="{voronoiParents}" i="{i}"
                                 width="{width}"
                                 height="{height}"
                                 cols="{columnCount-1}"></VoronoiMapQueue>
            </div>
        {/if}
    {/each}
</div>
