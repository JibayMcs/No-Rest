import mapboxgl from "mapbox-gl";

export default class Player {
    position = {};
    inventory = {};
    skinColor = '#f8d9b6';
    showInventory = false;
    maxHealth = 100;
    health = 100;
    hitboxRadius = 0.00005; // Rayon de collision
    interactionRadius = 0.0005; // Rayon pour l'interaction

    constructor(world) {
        this.world = world;
    }

    init() {
        this.loadPosition();
        this.loadInventory();
        this.world.map.setCenter(this.position);

        this.initPlayerMovement(this.world.map);
        this.initPlayerClickInteraction(this.world.map, this.world.buildings);
    }

    initPlayerMovement() {
        let {lat, lng} = this.position;
        const moveDistance = 0.000005;
        const cameraAltitude = 1200;
        const marker = new mapboxgl.Marker({color: this.skinColor})
            .setLngLat([lng, lat])
            .addTo(this.world.map)
            /*.setPopup(
                new mapboxgl.Popup()
                    .setHTML()
            )*/;

        // Ajout des cercles de debug pour la hitbox et la zone d'interaction
        /*map.addSource('hitbox-circle', {
            type: 'geojson',
            data: this.createCircleData([lng, lat], this.hitboxRadius)
        });

        map.addSource('interaction-circle', {
            type: 'geojson',
            data: this.createCircleData([lng, lat], this.interactionRadius)
        });*/

        //TODO Only for debug
        /*map.addLayer({
            id: 'hitbox-layer',
            type: 'circle',
            source: 'hitbox-circle',
            paint: {
                'circle-radius': {
                    stops: [[0, 0], [22, this.hitboxRadius * 1e6]]
                },
                'circle-color': '#ff0000',
                'circle-opacity': 0.03
            }
        });*/

        // Stockage de l'état des touches et des mouvements de souris
        const keysPressed = {z: false, s: false, q: false, d: false};

        window.addEventListener('keydown', (event) => {
            if (['z', 's', 'q', 'd'].includes(event.key)) {
                keysPressed[event.key] = true;
            }
        });

        window.addEventListener('keyup', (event) => {
            if (['z', 's', 'q', 'd'].includes(event.key)) {
                keysPressed[event.key] = false;
            }
        });

        const movePlayer = () => {
            let newLat = lat;
            let newLng = lng;

            if (keysPressed.z) newLat += moveDistance;
            if (keysPressed.s) newLat -= moveDistance;
            if (keysPressed.q) newLng -= moveDistance;
            if (keysPressed.d) newLng += moveDistance;

            const possiblePosition = [newLng, newLat];
            const buildings = this.world.map.queryRenderedFeatures(this.world.map.project(possiblePosition), {
                layers: ['3d-buildings']
            });

            if (buildings.length === 0) {
                lat = newLat;
                lng = newLng;
                this.position = {lat, lng};
                marker.setLngLat([lng, lat]);

                const camera = this.world.map.getFreeCameraOptions();

                camera.position = mapboxgl.MercatorCoordinate.fromLngLat({lng, lat}, cameraAltitude);

                const lookAtLng = lng;
                const lookAtLat = lat + 0.001;

                camera.lookAtPoint({lng: lookAtLng, lat: lookAtLat});
                this.world.map.setFreeCameraOptions(camera);

                // Mettre à jour les cercles pour suivre la position du joueur
                //TODO Only for debug
                /*map.getSource('hitbox-circle').setData(this.createCircleData([lng, lat], this.hitboxRadius));
                map.getSource('interaction-circle').setData(this.createCircleData([lng, lat], this.interactionRadius));*/
            }

            requestAnimationFrame(movePlayer);
        };

        requestAnimationFrame(movePlayer);
    }

    // Fonction utilitaire pour créer les données GeoJSON d'un cercle
    createCircleData([lng, lat], radius) {
        const points = 64;
        const coords = [];
        for (let i = 0; i < points; i++) {
            const angle = (i * 360) / points;
            const dx = radius * Math.cos((angle * Math.PI) / 180);
            const dy = radius * Math.sin((angle * Math.PI) / 180);
            coords.push([lng + dx, lat + dy]);
        }
        coords.push(coords[0]); // Ferme le polygone
        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [coords]
                    }
                }
            ]
        };
    }

    initPlayerClickInteraction() {
        this.world.map.on('click', (e) => {
            const clickedFeatures = this.world.map.queryRenderedFeatures(e.point, {
                layers: ['3d-buildings']
            });

            if (clickedFeatures.length) {
                const buildingFeature = clickedFeatures[0];

                // Vérifie si le bâtiment est dans la portée d'interaction
                const distance = this.calculateDistance([this.position.lng, this.position.lat], buildingFeature);
                if (distance <= this.interactionRadius) {
                    this.world.buildings.handleBuildingClick(this.world.map, buildingFeature); // Ouvre la popup du bâtiment
                } else {
                    console.log("Le bâtiment est hors de portée pour l'interaction.");
                }
            }
        });
    }

    calculateDistance(playerPosition, buildingFeature) {
        const [buildingLng, buildingLat] = buildingFeature.geometry.coordinates[0][0];
        const [playerLng, playerLat] = playerPosition;
        return Math.sqrt(Math.pow(buildingLng - playerLng, 2) + Math.pow(buildingLat - playerLat, 2));
    }

    // Charger la position du joueur depuis le localStorage
    loadPosition() {
        const savedPosition = localStorage.getItem('playerPosition');
        this.position = savedPosition ? JSON.parse(savedPosition) : this.position = {lat: 43.006085, lng: -0.094511};

        if (!savedPosition) {
            this.savePosition(this.position);
        }
    }

    // Sauvegarder la position du joueur dans le localStorage
    savePosition(position) {
        this.position = position;
        localStorage.setItem('playerPosition', JSON.stringify(position));
    }

    // Charger l'inventaire depuis le localStorage
    loadInventory() {
        const savedInventory = localStorage.getItem('playerInventory');
        this.inventory = savedInventory ? JSON.parse(savedInventory) : {};
    }

    toggleInventory(event) {
        if (event) {
            // Affiche ou masque l'inventaire lors de l'appui sur "I"
            if (event.key === 'i' || event.key === 'I') {
                this.showInventory = !this.showInventory;
            }

            if (this.showInventory && event.key === 'Escape') {
                this.showInventory = false
            }
        } else
            this.showInventory = !this.showInventory;
    }

    // Sauvegarder l'inventaire dans le localStorage
    saveInventory() {
        localStorage.setItem('playerInventory', JSON.stringify(this.inventory));
    }

    // Fonction pour ajouter un item à l'inventaire
    addItemToInventory(item) {
        if (this.inventory[item.id]) {
            this.inventory[item.id] = {
                quantity: this.inventory[item.id].quantity + 1,
                rarity: item.rarity,
            }
        } else {
            this.inventory[item.id] = {
                quantity: 1,
                rarity: item.rarity,
            }; // Ajouter l'item avec quantité 1 s'il n'existe pas
        }
        this.saveInventory(); // Sauvegarder l'inventaire mis à jour
    }
}
