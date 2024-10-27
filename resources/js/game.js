import L from 'leaflet';
import {lootTable} from "./game/loot_table.js";
import Player from "./game/player.js";

window.L = L;

Alpine.data('game', () => ({
    map: null,
    currentTime: 0,  // Temps écoulé en secondes pour le cycle jour/nuit
    dayDuration: 1200,  // 20 minutes en secondes pour le jour
    nightDuration: 1200, // 20 minutes en secondes pour la nuit
    isNight: false,  // Variable pour savoir si on est dans la période de nuit
    speed: 1,  // Facteur de vitesse pour accélérer le temps
    realTime: '',  // Heure actuelle
    gameTime: '',  // Heure du jeu
    player: new Player(),
    terrainLayers: [],
    playerMarker: null,
    lootTable: lootTable,

    init() {
        this.player.init();

        // Initialisation de l'icône de joueur
        const playerIcon = L.divIcon({
            html: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 613 613" enable-background="new 0 0 613 613" xml:space="preserve" style="fill: ${this.player.skinColor}; stroke: black; stroke-width: 20px; stroke-dasharray: 2,2; stroke-linejoin: round;"><path d="M314.419,12.317c37.098,4.821,66.06,45.185,66.06,93.906c0,26.98-9.241,51.072-23.476,68.24 c77.149,14.515,82.984,144.563,82.984,235.849h-53.504l-14.194,190.539H236.347L223.79,410.312h-50.773 c0-91.544-1.839-223.87,82.439-236.942c-13.622-17.089-22.384-40.835-22.384-67.147c0-51.966,33.077-93.906,73.702-93.906 C309.31,12.317,311.944,11.938,314.419,12.317L314.419,12.317z"/></svg>`,
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        // Initialisation de la carte
        this.map = L.map('map', {
            center: [this.player.position.lat, this.player.position.lng],
            zoom: 13,
            minZoom: 17,
            maxZoom: 18,
            zoomControl: false,
            attributionControl: false
        });

        // Marqueur du joueur
        this.playerMarker = L.marker([this.player.position.lat, this.player.position.lng], {icon: playerIcon}).addTo(this.map);

        // Ajout de la couche de base de la carte
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);

        this.updateRealTime();
        this.startGameClock();

        // Charger les données de terrain pour la position initiale
        this.loadForests(this.player.position.lat, this.player.position.lng);
        this.loadBuildings(this.player.position.lat, this.player.position.lng);
        this.loadHighways(this.player.position.lat, this.player.position.lng);
    },

    // Fonction de génération pseudo-aléatoire avec une seed
    seededRandom: function (seed) {
        let x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    },

    // Calculer l'aire d'un polygone en utilisant la formule de Shoelace
    calculateArea: function (coordinates) {
        let area = 0;
        const n = coordinates.length;

        for (let i = 0; i < n; i++) {
            const [x1, y1] = coordinates[i];
            const [x2, y2] = coordinates[(i + 1) % n];
            area += x1 * y2 - y1 * x2;
        }

        return Math.abs(area / 2);
    },

    // Compter le nombre de bâtiments à proximité dans un certain rayon
    countNearbyBuildings: function (buildings, currentBuilding, radius) {
        const [cx, cy] = currentBuilding.center;
        return buildings.filter(building => {
            const [bx, by] = building.center;
            const distance = Math.sqrt(Math.pow(bx - cx, 2) + Math.pow(by - cy, 2));
            return distance <= radius;
        }).length;
    },

    // Générer des loots en fonction de la taille et de la densité, sans doublons lorsque possible
    generateLoot: function (buildingId, area, density) {
        const lootItems = [];
        const randomGenerator = this.seededRandom(buildingId);
        const seenItems = new Set(); // Ensemble pour suivre les items déjà ajoutés

        // Ajuster le nombre de loots en fonction de l'aire et de la densité
        const lootCount = Math.floor((randomGenerator * 3) + 1 * Math.sqrt(area) / (density + 1));
        const maxLoots = Math.min(lootCount, 5); // Limite de loots par bâtiment

        for (let i = 0; i < maxLoots; i++) {
            // Essayez de tirer un item unique
            let attempts = 0;
            let item;

            do {
                const itemIndex = Math.floor(randomGenerator * this.lootTable.length);
                item = this.lootTable[itemIndex];
                attempts++;
            } while (seenItems.has(item.name) && attempts < this.lootTable.length);

            // Ajoute l'item si non déjà présent ou si doublon autorisé
            if (!seenItems.has(item.name) || attempts >= this.lootTable.length) {
                lootItems.push(item);
                seenItems.add(item.name); // Ajoute au Set pour suivre les doublons
            }
        }

        return lootItems;
    },

    // Charger les forêts
    loadForests: function (lat, lng) {
        fetch(`https://overpass-api.de/api/interpreter?data=[out:json][timeout:25];nwr["landuse"="forest"](around:5000,${lat},${lng});out geom;`)
            .then(response => response.json())
            .then(data => {
                data.elements.forEach(element => {
                    if (element.type === "way" && element.geometry) {
                        const coordinates = element.geometry.map(geom => [geom.lat, geom.lon]);
                        const forestLayer = L.polygon(coordinates, {color: "green", fillOpacity: 0.3});
                        forestLayer.addTo(this.map);
                        this.terrainLayers.push(forestLayer);
                    }
                });
            });
    },

    loadBuildings: function(lat, lng) {
        fetch(`https://overpass-api.de/api/interpreter?data=[out:json][timeout:25];nwr["building"](around:5000,${lat},${lng});out geom;`)
            .then(response => response.json())
            .then(data => {
                const buildings = [];

                data.elements.forEach(element => {
                    if (element.type === "way" && element.geometry) {
                        const coordinates = element.geometry.map(geom => [geom.lat, geom.lon]);
                        const center = coordinates.reduce((acc, [x, y]) => [acc[0] + x / coordinates.length, acc[1] + y / coordinates.length], [0, 0]);
                        const area = this.calculateArea(coordinates);

                        buildings.push({ id: element.id, coordinates, center, area });
                    }
                });

                buildings.forEach(building => {
                    const density = this.countNearbyBuildings(buildings, building, 0.005);
                    let loots = this.generateLoot(building.id, building.area, density);

                    // Charger l'état du loot pour ce bâtiment depuis localStorage
                    const savedLoot = this.loadBuildingLoot(building.id) || []; // Initialiser à un tableau vide si pas d'items sauvegardés
                    if (savedLoot.length) {
                        // Filtrer le loot pour n'inclure que les items non encore pris
                        loots = loots.filter(loot => !savedLoot.includes(loot.id));
                    }

                    const buildingLayer = L.polygon(building.coordinates, { color: "darkgray", fillOpacity: 0.7 });

                    buildingLayer.on('click', () => {
                        const lootList = loots.length > 0
                            ? loots.map((loot, index) => `<li id="loot-${building.id}-${index}" class="loot-item loot-item-rarity-${loot.rarity}">${loot.name}</li>`).join('')
                            : 'Bâtiment vide';

                        const lootSection = loots.length > 0 ? `<strong>Loot:</strong><ul>${lootList}</ul>` : 'Bâtiment vide';
                        const popupContent = `${lootSection}`;

                        buildingLayer.bindPopup(popupContent).openPopup();

                        // Ajouter des écouteurs pour chaque item de loot
                        if (loots.length > 0) {
                            loots.forEach((loot, index) => {
                                document.getElementById(`loot-${building.id}-${index}`).addEventListener('click', (event) => {
                                    this.player.addItemToInventory(loot); // Ajouter l'item à l'inventaire du joueur

                                    // Mettre à jour le tableau de loot sauvegardé pour le bâtiment
                                    const updatedLoot = this.loadBuildingLoot(building.id) || [];
                                    updatedLoot.push(loot.id);
                                    this.saveBuildingLoot(building.id, updatedLoot); // Sauvegarder l'état mis à jour

                                    // Supprimer l'item du loot du bâtiment localement
                                    loots = loots.filter(l => l.id !== loot.id);

                                    // Retirer l'élément du DOM pour refléter le changement visuel
                                    event.target.remove();
                                });
                            });
                        }
                    });

                    buildingLayer.addTo(this.map);
                    this.terrainLayers.push(buildingLayer);
                });
            });
    },

    // Charger l'état du loot du bâtiment depuis localStorage
    loadBuildingLoot: function(buildingId) {
        const savedLoot = localStorage.getItem(`buildingLoot_${buildingId}`);
        return savedLoot ? JSON.parse(savedLoot) : [];
    },

    // Sauvegarder l'état du loot du bâtiment dans localStorage
    saveBuildingLoot: function(buildingId, loot) {
        localStorage.setItem(`buildingLoot_${buildingId}`, JSON.stringify(loot));
    },


    // Charger les routes
    loadHighways: function (lat, lng) {
        fetch(`https://overpass-api.de/api/interpreter?data=[out:json][timeout:25];nwr["highway"](around:5000,${lat},${lng});out geom;`)
            .then(response => response.json())
            .then(data => {
                data.elements.forEach(element => {
                    if (element.type === "way" && element.geometry) {
                        const coordinates = element.geometry.map(geom => [geom.lat, geom.lon]);
                        const highwayLayer = L.polyline(coordinates, {color: "gray", weight: 2});
                        highwayLayer.addTo(this.map);
                        this.terrainLayers.push(highwayLayer);
                    }
                });
            });
    },

    // Mettre à jour l'heure actuelle en temps réel
    updateRealTime: function () {
        setInterval(() => {
            const now = new Date();
            this.realTime = now.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
        }, 1000);  // Mise à jour chaque seconde
    },

    // Démarrer le cycle jour/nuit et l'horloge du jeu
    startGameClock: function () {
        setInterval(() => {
            // Incrémente le temps en fonction de la vitesse
            this.currentTime += this.speed;

            // Calculer l'heure du jeu (jour de 24 heures)
            const totalDayNightDuration = this.dayDuration + this.nightDuration;
            const gameProgress = this.currentTime % totalDayNightDuration;

            let hours, minutes;

            if (gameProgress < this.dayDuration) {
                // Calculer l'heure pour la période de jour (6h à 18h)
                const dayProgress = (gameProgress / this.dayDuration) * 12; // Proportion dans la journée
                hours = Math.floor(dayProgress) + 6; // Convertir en heures fictives de 6h à 18h
                minutes = Math.floor((dayProgress % 1) * 60); // Minutes de 0 à 59
                this.isNight = false;
            } else {
                // Calculer l'heure pour la période de nuit (18h à 6h)
                const nightProgress = ((gameProgress - this.dayDuration) / this.nightDuration) * 12; // Proportion dans la nuit
                hours = Math.floor(nightProgress) + 18; // Convertir en heures fictives de 18h à 6h
                if (hours >= 24) hours -= 24; // Remettre les heures dans un format 24h si dépasse 24h
                minutes = Math.floor((nightProgress % 1) * 60); // Minutes de 0 à 59
                this.isNight = true;
            }

            // Formater l'heure du jeu avec 2 chiffres pour les heures et minutes
            this.gameTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

            // Appliquer la progression jour/nuit
            this.updateMapFilter();
        }, 1000);  // Exécuter chaque seconde pour un effet fluide
    },

    updateMapFilter: function () {
        const totalDayNightDuration = this.dayDuration + this.nightDuration;
        const gameProgress = this.currentTime % totalDayNightDuration;

        let brightness, contrast, hueRotate, invert;

        if (this.isNight) {
            // Progression de nuit avec limite des valeurs
            const nightProgress = (gameProgress - this.dayDuration) / this.nightDuration;

            // Transition fluide pour la nuit
            brightness = 0.8 + (0.15 * (1 - nightProgress));   // Varie de 0.95 à 0.8 pour simuler la tombée de la nuit
            hueRotate = 180;                                   // Teinte fixe à 180° la nuit
            invert = 1;                                        // Inversion totale pour la nuit

            // Remettre les valeurs à la fin de la nuit pour transition vers le jour
            if (nightProgress >= 1) {
                brightness = 1;
                hueRotate = 0;
                invert = 0;
            }
        } else {
            // Progression de jour
            const dayProgress = gameProgress / this.dayDuration;

            // Transition fluide entre lever du jour et plein jour
            brightness = 0.9 + (0.1 * dayProgress);            // Varie de 0.9 à 1
            hueRotate = 0;                                     // Reste à 0° pour le jour
            invert = 0;                                        // Pas d'inversion en journée

            // Remettre les valeurs maximales en pleine journée
            if (dayProgress >= 1) {
                brightness = 1;
                hueRotate = 0;
                invert = 0;
            }
        }

        // Applique le filtre mis à jour à la carte
        document.getElementById('map').style.filter =
            `invert(${invert * 100}%) hue-rotate(${hueRotate}deg) brightness(${brightness}) contrast(1)`;
    },

}));
