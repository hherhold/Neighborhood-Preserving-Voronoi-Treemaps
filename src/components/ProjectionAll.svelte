<script>
    // import * as druid from '@/external/druid'
    // import.meta.glob("../../static/*.jpg");
    // import * as druid from "@saehrimnir/druidjs";
    // import  * as druid from "../external/druid.js";
    import * as druid from "@saehrimnir/druidjs";
    import {
        dict,
        initializeWithPrecomputedPositions,
        projectionDone,
        projectionStore,
        projectionStoreDepthDict,
        queueGrouped,
        simAttribute,
        useInternalEmbeddings,
        vectorStore
    } from "../store";
    import * as d3 from "d3";

    export let nodes = [];
    export let depth = -1;
    export let width = 640;
    export let height = 640;

    let centroids = []
    let colorDistances = [];
    let colorDistancesWord = [];
    let dataArray = [];

    const getSimilarities = async () => {
        let promises = []
        for (let node of nodes) {
            let name = node.data.name
            if (name === undefined) {
                name = node.data.id
            }
            promises.push(
                d3.json('http://127.0.0.1:5000/word2vec/model?word=' + name.replaceAll(" ", "_").toLowerCase())//,
                    .then(function (data) {
                        if (data) {
                            colorDistances.push(data)
                        } else {
                            let emptyArray = new Array(300).fill(0);
                            colorDistances.push(emptyArray)
                        }
                        colorDistancesWord.push(node.data.id)
                        return data;
                    }))
        }
        return Promise.all(promises);
    }

    $: if (Object.values($dict).length > 0 && !$projectionDone) {
        centroids = []
        colorDistances = [];
        colorDistancesWord = [];
        dataArray = [];
        // console.log(nodes.length)
        if ($useInternalEmbeddings) {
            if ($initializeWithPrecomputedPositions === true) {
                for (let i = 0; i < nodes.length; i++) {
                    dataArray.push(nodes[i].data.centroid[0]);
                }
            } else {
                for (let i = 0; i < nodes.length; i++) {
                    if (nodes[i].data.hasOwnProperty($simAttribute)) {
                        colorDistances.push(nodes[i].data[$simAttribute])
                        colorDistancesWord.push(nodes[i].data.id)
                        $vectorStore[nodes[i].data.id] = nodes[i].data[$simAttribute];
                    } else {
                    }
                }
                const X = druid.Matrix.from(colorDistances); // X is the data as object of the Matrix class.
                const DR = druid.PCA; // DR is the selected DR class
                let dr = new DR(X, druid.cosine)
                let Y = dr.transform();
                dataArray = Y.to2dArray
            }
            let maxX = Math.max(...dataArray.map(d => d[0]))
            let minX = Math.min(...dataArray.map(d => d[0]))
            let maxY = Math.max(...dataArray.map(d => d[1]))
            let minY = Math.min(...dataArray.map(d => d[1]))

            //calc euclid distance from umap position to vornoi cells
            //outer shape has to be the same
            let offset = 70;
            let x = d3.scaleLinear()
                .range([offset, width - offset])
                .domain([minX, maxX]);

            let y = d3.scaleLinear()
                .range([offset, height - offset])
                .domain([minY, maxY]);

            dataArray = dataArray.map(d => {
                return [x(d[0]), y(d[1])]
            })
            if ($initializeWithPrecomputedPositions === true) {
                for (let i = 0; i < nodes.length; i++) {
                    if (nodes[i].data.hasOwnProperty($simAttribute)) {
                        $vectorStore[nodes[i].data.id] = nodes[i].data[$simAttribute][0];
                        colorDistances.push(nodes[i].data[$simAttribute][0])
                        $projectionStore[nodes[i].data.id] = dataArray[i];
                        colorDistancesWord.push(nodes[i].data.id)
                    }
                }
            } else {
                for (let i = 0; i < dataArray.length; i++) {
                    $projectionStore[colorDistancesWord[i]] = dataArray[i];
                }
            }

            projectionDone.set(true)
        } else {
            getSimilarities().then(function () {

                const X = druid.Matrix.from(colorDistances); // X is the data as object of the Matrix class.
                const DR = druid["PCA"]; // DR is the selected DR class
                let dr = new DR(X, druid.cosine)
                let Y = dr.transform();
                dataArray = Y.to2dArray;
                let maxX = Math.max(...dataArray.map(d => d[0]))
                let minX = Math.min(...dataArray.map(d => d[0]))
                let maxY = Math.max(...dataArray.map(d => d[1]))
                let minY = Math.min(...dataArray.map(d => d[1]))

                //calc euclid distance from umap position to vornoi cells
                //outer shape has to be the same
                let offset = 70;
                let x = d3.scaleLinear()
                    .range([offset, width - offset])
                    .domain([minX, maxX]);

                let y = d3.scaleLinear()
                    .range([offset, height - offset])
                    .domain([minY, maxY]);

                //Set the vectors for each id
                for (let i = 0; i < colorDistancesWord.length; i++) {
                    let id = colorDistancesWord[i]
                    $vectorStore[id] = colorDistances[i];
                }
                dataArray = dataArray.map(d => {
                    return [x(d[0]), y(d[1])]
                })
                for (let i = 0; i < colorDistancesWord.length; i++) {
                    let id = colorDistancesWord[i]
                    $projectionStore[id] = dataArray[i];
                }
                //create dataobj and save to file
                projectionDone.set(true)
            });
        }
    }
</script>

<svg height="{height}" id="projection" width="{width}">
    {#if $projectionDone}
        {#if $projectionStoreDepthDict.hasOwnProperty(1) }
        {#each $queueGrouped[0] as node}
            {#if node.hasOwnProperty('clippingPolygon') }
                <path d="{d3.line()(node.clippingPolygon) + 'z'}" stroke="rgb(0, 0, 0)" stroke-width="1px"
                      fill="none"
                      pointer-events="all"/>
            {/if}
        {/each}
        {/if}
        {#each dataArray as point,i}
            <g transform="translate({point[0]},{point[1]})">
                <circle class="labelsCircleBig" r="1" cx="{0}" cy="{0}" fill="black"></circle>
            </g>
        {/each}
    {/if}
</svg>


