<script>
    import {voronoiStore} from "../store";
    $: color = ({context}) => {
        for (let i = 0; i < $voronoiStore.length; i = i + 1) {
            context.fillStyle = 'black';
            context.beginPath();
            let x0 = $voronoiStore[i][0];
            let y0 = $voronoiStore[i][1];
            context.moveTo(x0, y0);
            context.arc(x0, y0, 20, 0, 2 * Math.PI, false);
            context.fill();
            context.font = '48px serif';
        }
    }
</script>

