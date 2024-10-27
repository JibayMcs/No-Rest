import mapboxgl from "mapbox-gl";

export default class Biome {
    constructor(world) {
        this.world = world;
        this.map = this.world.map;
        this.player = this.world.player;
        this.resourceMarkers = [];
    }

    async init() {
        // await this.generateNaturalResourceMarkers();
    }

    async generateNaturalResourceMarkers() {
        const playerPosition = [this.player.position.lng, this.player.position.lat];
        const bbox = this.calculateBBox(playerPosition, 1); // Rayon de recherche de 1 km autour du joueur
        const maxMarkers = 20;
        let markerCount = 0;

        try {
            const response = await fetch(`https://overpass-api.de/api/interpreter?data=[out:json][timeout:25];
            (
              nwr["landuse"="grass"](${bbox});
              nwr["landuse"="forest"](${bbox});
              nwr["landuse"="farmland"](${bbox});
            );
            out geom;`);
            const data = await response.json();

            console.log("Données récupérées :", data.elements);

            if (data.elements.length === 0) {
                console.warn("Aucune zone naturelle trouvée dans cette zone.");
            }

            data.elements.forEach((feature) => {
                if (markerCount >= maxMarkers) return; // Stopper si le nombre de marqueurs maximum est atteint

                if (feature.type === "way" && feature.geometry) {
                    // Pour les éléments de type "way"
                    const coordinates = feature.geometry.map(coord => [coord.lon, coord.lat]);
                    const area = this.calculateArea(coordinates);

                    markerCount += this.addRandomMarkers(coordinates, area, playerPosition, maxMarkers - markerCount);

                } else if (feature.type === "relation" && feature.members) {
                    // Pour les éléments de type "relation"
                    feature.members.forEach(member => {
                        if (markerCount >= maxMarkers) return; // Stopper si le nombre de marqueurs maximum est atteint

                        if (member.type === "way" && member.geometry) {
                            const coordinates = member.geometry.map(coord => [coord.lon, coord.lat]);
                            const area = this.calculateArea(coordinates);

                            markerCount += this.addRandomMarkers(coordinates, area, playerPosition, maxMarkers - markerCount);
                        }
                    });
                } else {
                    console.warn("Feature ignorée (pas de géométrie ou type non géré) :", feature);
                }
            });

            console.log("Nombre total de marqueurs générés :", markerCount);
        } catch (error) {
            console.error("Erreur lors de la récupération des zones naturelles :", error);
        }
    }

    calculateBBox(center, radiusKm) {
        const lat = center[1];
        const lng = center[0];
        const deltaLat = radiusKm / 111.32;
        const deltaLng = radiusKm / (111.32 * Math.cos(lat * (Math.PI / 180)));
        return `${lat - deltaLat},${lng - deltaLng},${lat + deltaLat},${lng + deltaLng}`;
    }

    calculateArea(coordinates) {
        let area = 0;
        const n = coordinates.length;
        for (let i = 0; i < n; i++) {
            const [x1, y1] = coordinates[i];
            const [x2, y2] = coordinates[(i + 1) % n];
            area += x1 * y2 - y1 * x2;
        }
        return Math.abs(area / 2);
    }

    addRandomMarkers(coordinates, area, playerPosition, remainingMarkers) {
        const maxMarkersInArea = 20;
        let addedMarkers = 0;

        console.log("Nombre de marqueurs à ajouter dans cette zone :", maxMarkersInArea);

        for (let i = 0; i < maxMarkersInArea; i++) {
            const randomPosition = this.getRandomPositionInPolygon(coordinates);
            console.log("Position aléatoire générée :", randomPosition);

            if (randomPosition && this.calculateDistance(randomPosition, playerPosition) <= 500) {
                const marker = new mapboxgl.Marker({ color: 'darkgreen' })
                    .setLngLat(randomPosition)
                    .addTo(this.map);

                marker.getElement().addEventListener('click', () => {
                    this.collectResource(marker);
                });

                this.resourceMarkers.push(marker);
                addedMarkers++;
            } else {
                // console.warn("Position aléatoire invalide ou hors du rayon de 500 m.");
            }
        }

        return addedMarkers;
    }

    collectResource(marker) {
        marker.remove();
        const index = this.resourceMarkers.indexOf(marker);
        if (index !== -1) this.resourceMarkers.splice(index, 1);

        console.log("Ressource collectée!");
    }

    // Calcul de la distance entre deux points (en mètres)
    calculateDistance(coord1, coord2) {
        const R = 6371e3; // Rayon de la Terre en mètres
        const φ1 = (coord1[1] * Math.PI) / 180; // Latitude en radians
        const φ2 = (coord2[1] * Math.PI) / 180;
        const Δφ = ((coord2[1] - coord1[1]) * Math.PI) / 180;
        const Δλ = ((coord2[0] - coord1[0]) * Math.PI) / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance en mètres
    }


    getRandomPositionInPolygon(coordinates) {
        const [minLng, maxLng] = [Math.min(...coordinates.map(c => c[0])), Math.max(...coordinates.map(c => c[0]))];
        const [minLat, maxLat] = [Math.min(...coordinates.map(c => c[1])), Math.max(...coordinates.map(c => c[1]))];

        let point;
        let isInside = false;

        while (!isInside) {
            const randomLng = minLng + Math.random() * (maxLng - minLng);
            const randomLat = minLat + Math.random() * (maxLat - minLat);
            point = [randomLng, randomLat];
            isInside = this.isPointInPolygon(point, coordinates);
        }

        return point;
    }

    isPointInPolygon(point, polygon) {
        const [x, y] = point;
        let isInside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    }
}
