# Neighborhood-Preserving-Voronoi-Treemaps

## About

Neighborhood Preserving Voronoi Treemaps is an adaptation of traditional weighted Voronoi treemaps.  
The goal of the technique is to preserve existing similarities within the data as neighborhoods in the Voronoi treemap.
In this repository, you will find a link to the current, preliminary tool and a preliminary version of the code. 
A more polished version will be released upon publication.  

# Online Tool
We are hosting a preliminary version of the tool at [https://voronoitreemap.de](https://voronoitreemap.de).
The tool has only been tested on a 4k monitor with the Chrome browser.
We plan to test for other browsers and smaller resolutions in the future.
# Installation

If using IntellJ, keep with node v16, as otherwise IntellJ has problem debugging local modules.

We have to link after each npm install run. First have to add the libs at the location.

```bash
npm install
cd modules/d3-voronoi-map | npm link
cd modules/d3-weighted-voronoi | npm link
npm link d3-voronoi-map d3-weighted-voronoi

npm install modules/d3-weighted-voronoi modules/d3-voronoi-map
```

Add additional libs using

```bash
npx svelte-add@latest tailwindcss pnpm install
```

# Disclaimer

The voronoi implementation builds upon the excellent d3 projects d3-weighted-voronoi and d3-voronoi-map by LEBEAU Franck.
Our project includes forks and of both repos and is in no way involved with or supported by the creators of d3-weighted-voronoi and d3-voronoi-map .


