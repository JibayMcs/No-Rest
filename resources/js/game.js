import * as maptiler from '@maptiler/sdk';
import mapboxgl from 'mapbox-gl'; // or "const mapboxgl = require('mapbox-gl');"
import {lootTable} from "./game/loot_table.js";

import World from "./game/world.js";

Alpine.data('game', () => ({
    map: null,
    currentTime: 0,  // Temps écoulé en secondes pour le cycle jour/nuit
    dayDuration: 1200,  // 20 minutes en secondes pour le jour
    nightDuration: 1200, // 20 minutes en secondes pour la nuit
    isNight: false,  // Variable pour savoir si on est dans la période de nuit
    speed: 1,  // Facteur de vitesse pour accélérer le temps
    realTime: '',  // Heure actuelle
    gameTime: '',  // Heure du jeu
    world: null,
    lootTable: lootTable,
    player: null,
    buildings: null,
    playerMarker: null,

    init: function() {

        //disable Ctrl + S and Ctrl + U
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && (e.key === 's' || e.key === 'u')) {
                e.preventDefault();
            }
        });

        //disable right click
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });

        this.updateRealTime();
        this.startGameClock();

        this.initMap().then(async () => {
            console.log('Map initialized');
            await this.dayNightCycle();

            this.world = new World(this.map);
            await this.world.init();

            this.player = this.world.player;
            this.buildings = this.world.buildings;

            /*this.buildings.init(this.player);
            this.updateRealTime();
            this.startGameClock();

            this.map.on('style.load', () => {
                // Ajouter la couche de bâtiments 3D avec des couleurs dynamiques basées sur l'état
                this.map.addLayer({
                    'id': '3d-buildings-hover',
                    'source': 'composite',
                    'source-layer': 'building',
                    'filter': ['==', 'extrude', 'true'],
                    'type': 'fill-extrusion',
                    'minzoom': 15,
                    'paint': {
                        'fill-extrusion-color': [
                            'case',
                            ['boolean', ['feature-state', 'hover'], false],
                            '#FF6347',  // Couleur au survol (ex: rouge tomate)
                            '#aaa'      // Couleur par défaut (ex: gris)
                        ],
                        'fill-extrusion-height': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            15,
                            0,
                            15.05,
                            ['get', 'height']
                        ],
                        'fill-extrusion-base': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            15,
                            0,
                            15.05,
                            ['get', 'min_height']
                        ],
                        'fill-extrusion-opacity': 0.6
                    }
                });
            });

            let hoveredBuildingId = null;

            // Gérer l'événement mouseenter pour activer l'état hover
            this.map.on('mouseenter', '3d-buildings', (e) => {
                this.map.getCanvas().style.cursor = 'pointer';

                if (e.features.length > 0) {
                    if (hoveredBuildingId) {
                        this.map.setFeatureState(
                            {source: 'composite', sourceLayer: 'building', id: hoveredBuildingId},
                            {hover: false}
                        );
                    }

                    hoveredBuildingId = e.features[0].id;
                    this.map.setFeatureState(
                        {source: 'composite', sourceLayer: 'building', id: hoveredBuildingId},
                        {hover: true}
                    );
                }
            });

            // Gérer l'événement mouseleave pour désactiver l'état hover
            this.map.on('mouseleave', '3d-buildings', () => {
                this.map.getCanvas().style.cursor = '';

                if (hoveredBuildingId) {
                    this.map.setFeatureState(
                        {source: 'composite', sourceLayer: 'building', id: hoveredBuildingId},
                        {hover: false}
                    );
                }

                hoveredBuildingId = null;
            });

            await this.dayNightCycle();

            this.player.initPlayerMovement(this.map);
            // Dans Player
            this.player.initPlayerClickInteraction(this.map, this.buildings);*/
        });
    },

    updateRealTime: function() {
        setInterval(() => {
            const now = new Date();
            this.realTime = now.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }, 1000);
    },

    startGameClock: function() {
        setInterval(() => {
            this.currentTime += this.speed;
            const totalDayNightDuration = this.dayDuration + this.nightDuration;
            const gameProgress = this.currentTime % totalDayNightDuration;

            let hours, minutes;
            if (gameProgress < this.dayDuration) {
                const dayProgress = (gameProgress / this.dayDuration) * 12;
                hours = Math.floor(dayProgress) + 6;
                minutes = Math.floor((dayProgress % 1) * 60);
                this.isNight = false;
            } else {
                const nightProgress = ((gameProgress - this.dayDuration) / this.nightDuration) * 12;
                hours = Math.floor(nightProgress) + 18;
                if (hours >= 24) hours -= 24;
                minutes = Math.floor((nightProgress % 1) * 60);
                this.isNight = true;
            }

            this.gameTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }, 1000);
    },

    initMap: async function () {
        this.map = new mapboxgl.Map({
            accessToken: import.meta.env.VITE_MAPBOX_TOKEN,
            container: 'map',
            interactive: false,
            antialias: true,
            style: import.meta.env.VITE_MAPBOX_STYLE
        });
    },

    dayNightCycle: async function() {
        await this.map.once('style.load');

        this.map.setFog({
            'range': [-1, 2],
            'horizon-blend': 0.3,
            'color': 'white',
            'high-color': '#add8e6',
            'space-color': '#d8f2ff',
            'star-intensity': 0.0
        });

        this.map.addSource('mapbox-dem', {
            'type': 'raster-dem',
            'url': 'mapbox://mapbox.terrain-rgb',
            'tileSize': 512,
            'maxzoom': 14
        });

        this.map.setTerrain({
            'source': 'mapbox-dem',
            'exaggeration': 1.5
        });

        this.map.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill-extrusion',
            'minzoom': 15,
            'paint': {
                'fill-extrusion-color': '#aaa',
                'fill-extrusion-height': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    15,
                    0,
                    15.05,
                    ['get', 'height']
                ],
                'fill-extrusion-base': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    15,
                    0,
                    15.05,
                    ['get', 'min_height']
                ],
                'fill-extrusion-opacity': 0.6
            }
        });

        const updateCycle = () => {
            const [gameHours] = this.gameTime.split(':').map(Number);

            if (gameHours >= 6 && gameHours < 18) {
                this.map.setFog({
                    'range': [-1, 2],
                    'horizon-blend': 0.3,
                    'color': 'white',
                    'high-color': '#add8e6',
                    'space-color': '#d8f2ff',
                    'star-intensity': 0.0
                });
            } else {
                this.map.setFog({
                    'range': [-1, 2],
                    'horizon-blend': 0.3,
                    'color': '#242B4B',
                    'high-color': '#161B36',
                    'space-color': '#0B1026',
                    'star-intensity': 0.8
                });
            }

            setTimeout(updateCycle, 1000);
        };

        updateCycle();
    }
}));
