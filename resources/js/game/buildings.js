import { lootTable } from "./loot_table.js";
import mapboxgl from "mapbox-gl";

export default class Buildings {

    constructor(world) {
        this.world = world;
    }

    init() {
        this.player = this.world.player;
    }

    seededRandom(seed) {
        let x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    countNearbyBuildings(buildingId, area, map) {
        const buildings = map.querySourceFeatures('buildings', { sourceLayer: 'buildings-layer' });
        const currentBuilding = buildings.find(building => building.id === buildingId);

        if (!currentBuilding || !currentBuilding.geometry) return 0;

        const [cx, cy] = currentBuilding.geometry.coordinates[0][0];
        return buildings.filter(building => {
            const [bx, by] = building.geometry.coordinates[0][0];
            const distance = this.calculateDistance({ lat: cy, lng: cx }, { lat: by, lng: bx });
            return distance <= 0.005;
        }).length;
    }

    generateLoot(buildingId, area, density) {
        const lootItems = [];
        const randomGenerator = this.seededRandom(buildingId);
        const seenItems = new Set();

        const maxLoots = Math.min(Math.floor(randomGenerator * 2 + Math.sqrt(area) / (density + 1)), 5);
        const numLoots = Math.max(1, Math.floor(this.seededRandom(buildingId + 1) * maxLoots));

        let attempts = 0;
        while (lootItems.length < numLoots && attempts < lootTable.length * 2) {
            const itemIndex = Math.floor(this.seededRandom(buildingId + attempts) * lootTable.length);
            const item = lootTable[itemIndex];

            if (!seenItems.has(item.name)) {
                lootItems.push(item);
                seenItems.add(item.name);
            }
            attempts++;
        }

        return lootItems;
    }

    isBuildingWithinInteractionRadius(buildingFeature, player) {
        const playerPosition = player.position;
        const buildingCoordinates = buildingFeature.geometry.coordinates[0][0];

        const distance = this.calculateDistance(playerPosition, {
            lat: buildingCoordinates[1],
            lng: buildingCoordinates[0]
        });

        return distance >= player.interactionRadius;
    }

    displayBuildingLoot(map, buildingFeature) {
        const buildingId = buildingFeature.id;
        const area = 100;  // Placeholder for building area
        const density = 0; // Placeholder for density
        let loots = this.generateLoot(buildingId, area, density);

        const savedLoot = this.loadBuildingLoot(buildingId) || [];
        loots = loots.filter(loot => !savedLoot.includes(loot.id));

        const updatePopupContent = () => {
            const lootList = loots.length > 0
                ? loots.map((loot, index) =>
                    `<li id="loot-${buildingId}-${index}" class="loot-item loot-item-rarity-${loot.rarity}">${loot.name}</li>`
                ).join('')
                : 'Bâtiment vide';

            const lootSection = loots.length > 0 ? `<strong>Loot:</strong><ul>${lootList}</ul>` : 'Bâtiment vide';
            popup.setHTML(lootSection);

            if (loots.length === 0) {
                popup.setHTML('Bâtiment vide');
            }
        };

        const popup = new mapboxgl.Popup()
            .setLngLat(buildingFeature.geometry.coordinates[0][0])
            .setHTML('') // Placeholder, we’ll update immediately
            .addTo(map);

        // Initial update of the popup content
        updatePopupContent();

        loots.forEach((loot, index) => {
            document.addEventListener('click', (event) => {
                if (event.target && event.target.id === `loot-${buildingId}-${index}`) {
                    this.player.addItemToInventory(loot);

                    const updatedLoot = this.loadBuildingLoot(buildingId) || [];
                    updatedLoot.push(loot.id);
                    this.saveBuildingLoot(buildingId, updatedLoot);

                    // Supprimer l'item de la liste des loots et actualiser la popup
                    loots = loots.filter(l => l !== loot);
                    updatePopupContent();
                }
            });
        });
    }

    calculateDistance(point1, point2) {
        const R = 6371e3;
        const φ1 = (point1.lat * Math.PI) / 180;
        const φ2 = (point2.lat * Math.PI) / 180;
        const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
        const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    handleBuildingClick(map, buildingFeature) {
        if (!this.isBuildingWithinInteractionRadius(buildingFeature, this.player)) return;

        this.displayBuildingLoot(map, buildingFeature);
    }

    loadBuildingLoot(buildingId) {
        const savedLoot = localStorage.getItem(`buildingLoot_${buildingId}`);
        return savedLoot ? JSON.parse(savedLoot) : [];
    }

    saveBuildingLoot(buildingId, loot) {
        localStorage.setItem(`buildingLoot_${buildingId}`, JSON.stringify(loot));
    }
}
