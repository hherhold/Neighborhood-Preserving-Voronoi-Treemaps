<script>
    import {
        datasetID,
        dataStore,
        edgeMultiplier,
        externalInitialization,
        initializationStrategies,
        initializeWithPrecomputedPositions,
        loadedDataset,
        resetStore,
        selectedInitializationStrategyID,
        shouldShuffle,
        showIcons,
        showmissingLinks,
        showNames,
        showSimilarityConstraints,
        showVectors,
        simAttribute,
        similarityMeasure,
        tabMultiplier,
        useCategoricalColors,
        useInternalEmbeddings,
        useNeighborLeafs,
        useSimilarityMatrix,
        weightAttribute
    } from '../store.js';
    import {Button, Checkbox} from 'svelte-mui/src';
    import Slider from '@smui/slider';
    import FormField from '@smui/form-field';

    import Select, {Option} from '@smui/select';
    import * as d3 from "d3";

    //Import all real datasets
    const json_data = import.meta.glob("../data/*.json", {as: 'raw', eager: true});
    const json_data_initialization = import.meta.glob("../data/initialization/*.json", {as: 'raw', eager: true});
    const datasets = [];
    for (const path in json_data) {
        const data_parsed = JSON.parse(json_data[path])
        let obj = {id: datasets.length, text: path, data: data_parsed}
        //Similarity Attribute
        if ('simAttribute' in data_parsed) {
            obj['simAttribute'] = data_parsed['simAttribute']
        } else {
            obj['simAttribute'] = 'embeddings'
        }
        //Weight Attribute
        if ('weightAttribute' in data_parsed) {
            obj['weightAttribute'] = data_parsed['weightAttribute']
        } else {
            obj['weightAttribute'] = 'weight'
        }
        //Similarity Measure
        if ('similarityMeasure' in data_parsed) {
            obj['similarityMeasure'] = data_parsed['similarityMeasure']
        } else {
            obj['similarityMeasure'] = 'cosine'
        }

        //Use Neighbor Similarity
        if ('useNeighborLeafs' in data_parsed) {
            obj['useNeighborLeafs'] = data_parsed['useNeighborLeafs']
        } else {
            obj['useNeighborLeafs'] = false
        }

        //Use Categorical colors
        if ('useCategoricalColors' in data_parsed) {
            obj['useCategoricalColors'] = data_parsed['useCategoricalColors']
        } else {
            obj['useCategoricalColors'] = false
        }

        //Use Similarity Matrix
        if ('useSimilarityMatrix' in data_parsed) {
            obj['useSimilarityMatrix'] = data_parsed['useSimilarityMatrix']
        } else {
            obj['useSimilarityMatrix'] = false
        }
        datasets.push(obj)
    }

    const datasets_initializations = [];
    for (const path in json_data_initialization) {
        const data_parsed = JSON.parse(json_data_initialization[path])
        datasets_initializations.push(data_parsed)
    }

    let currDatasetID = -1;
    let selected = 0;
    let answer = 3;
    let isChecked = false;

    function handleSubmit() {
        resetStore()
        datasetID.set(answer);
        currDatasetID = answer;
        shouldShuffle.set(isChecked)
    }

    $: if (currDatasetID >= 0 && $loadedDataset === false) {
        useSimilarityMatrix.set(datasets[currDatasetID].data.useSimilarityMatrix)
        useInternalEmbeddings.set(datasets[currDatasetID].data.useInternalEmbeddings);
        initializeWithPrecomputedPositions.set(datasets[currDatasetID].data.initializeWithPrecomputedPositions);
        weightAttribute.set(datasets[currDatasetID].data.weightAttribute)
        simAttribute.set(datasets[currDatasetID].simAttribute)
        similarityMeasure.set(datasets[currDatasetID].similarityMeasure)
        useNeighborLeafs.set(datasets[currDatasetID].useNeighborLeafs)
        useCategoricalColors.set(datasets[currDatasetID].useCategoricalColors)
        loadExternalDataset(datasets[currDatasetID].data);
    }

    function loadExternalDataset(jsonFile) {
        let hierarchy = d3.hierarchy(jsonFile)
        dataStore.set(hierarchy);
        loadedDataset.set(true);
        externalInitialization.set(datasets_initializations[0]);
    }

    let checked
</script>
<div class="grid grid-cols-4 gap-4" id="DataLoader">
    <div class="col-span-1">
        <Select bind:value="{$selectedInitializationStrategyID}" class="w-300" label="Select Initialization Stratgey">
            {#each $initializationStrategies as strategy}
                <Option value={strategy.id}>{strategy.name}</Option>
            {/each}
        </Select>
    </div>
    <div class="col-span-1">
        <Select bind:value="{answer}" class="w-300" label="Select Dataset">
            {#each datasets as ds}
                <Option value={ds.id}>{ds.text}</Option>
            {/each}
        </Select>
    </div>
    <div class="col-span-1 inline-flex">
        <Button color="#ff4d14" on:click={handleSubmit} raised>Apply</Button>
    </div>
    <div class="col-span-3 inline-flex">
        <Checkbox bind:checked={$showNames}> Show names</Checkbox>
        <Checkbox bind:checked={$showIcons}> Show disconnect icons</Checkbox>
        <Checkbox bind:checked={$showmissingLinks}> Show missing sim. constraints</Checkbox>
        <Checkbox bind:checked={$showSimilarityConstraints}> Show sim. constraints</Checkbox>
        <Checkbox bind:checked={$showVectors}> Show vectors</Checkbox>

    </div>
    <div class="col-span-1">
        <FormField align="end" style="display: flex;">
            <Slider bind:value={$tabMultiplier}
                    input$aria-label="Continuous slider"
                    max={2}
                    min={0.25}
                    step={0.05}
                    style="flex-grow: 1;"
            />

            <pre class="status">Value: {$tabMultiplier}</pre>

            <Slider bind:value={$edgeMultiplier}
                    input$aria-label="Continuous slider"
                    max={2}
                    min={0.25}
                    step={0.05}
                    style="flex-grow: 1;"
            />

            <pre class="status">Value: {$edgeMultiplier}</pre>
        </FormField>
    </div>

</div>
