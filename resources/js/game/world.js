import Player from "./player.js";
import Buildings from "./buildings.js";
import Biome from "./biome.js";

export default class World {
    constructor(map) {
        this.map = map;
        this.player = new Player(this);
        this.visitedCells = new Set();
        this.cellSize = 0.001;
        this.buildings = new Buildings(this);
        this.biome = new Biome(this);
    }

    async init() {
        await this.player.init();
        this.buildings.init();
        await this.biome.init();
    }

}
