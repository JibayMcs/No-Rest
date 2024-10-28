import mapboxgl from "mapbox-gl";

export default class Player {
    position = {};
    inventory = {};
    skinColor = '#f8d9b6';
    showInventory = false;
    maxHealth = 100;
    health = 100;
    maxStamina = 100;
    stamina = 100;
    isSprinting = false;
    isMoving = false;

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
        const baseMoveDistance = 0.0000005;
        const sprintMoveDistance = 0.000001; // Vitesse en sprint
        const cameraAltitude = 700;

        const marker = new mapboxgl.Marker({color: this.skinColor})
            .setLngLat([lng, lat])
            .addTo(this.world.map);

        const keysPressed = {z: false, s: false, q: false, d: false};

        // Gestion des touches directionnelles
        window.addEventListener('keydown', (event) => {
            if (['z', 's', 'q', 'd'].includes(event.key)) {
                keysPressed[event.key] = true;
                this.isMoving = true;
            }

            // Activer le sprint si Shift est pressée avec une touche de déplacement
            if (event.key === 'Shift' && this.isMoving) {
                this.isSprinting = true;
            }
        });

        window.addEventListener('keyup', (event) => {
            if (['z', 's', 'q', 'd'].includes(event.key)) {
                keysPressed[event.key] = false;
                // Vérifiez si toutes les touches de direction sont relâchées
                if (!keysPressed.z && !keysPressed.s && !keysPressed.q && !keysPressed.d) {
                    this.isMoving = false;
                }
            }

            // Désactiver le sprint si Shift est relâchée ou si aucune touche de déplacement n'est pressée
            if (event.key === 'Shift' || !this.isMoving) {
                this.isSprinting = false;
            }
        });

        const movePlayer = () => {
            let newLat = lat;
            let newLng = lng;

            // Choisir la distance en fonction du sprint et de la stamina
            const moveDistance = (this.isSprinting && this.stamina > 0) ? sprintMoveDistance : baseMoveDistance;

            if (this.isMoving) {
                if (keysPressed.z) newLat += moveDistance;
                if (keysPressed.s) newLat -= moveDistance;
                if (keysPressed.q) newLng -= moveDistance;
                if (keysPressed.d) newLng += moveDistance;
            }

            const possiblePosition = [newLng, newLat];
            const buildings = this.world.map.queryRenderedFeatures(this.world.map.project(possiblePosition), {
                layers: ['3d-buildings']
            });

            if (buildings.length === 0) {
                lat = newLat;
                lng = newLng;
                this.position = {lat, lng};
                marker.setLngLat([lng, lat]);

                // Mise à jour de la caméra
                const camera = this.world.map.getFreeCameraOptions();
                camera.position = mapboxgl.MercatorCoordinate.fromLngLat({lng, lat}, cameraAltitude);
                const lookAtLng = lng;
                const lookAtLat = lat + 0.00009;
                camera.lookAtPoint({lng: lookAtLng, lat: lookAtLat});
                this.world.map.setFreeCameraOptions(camera);
            }

            // Gestion de la stamina
            if (this.isSprinting && this.stamina > 0 && this.isMoving) {
                this.stamina -= 0.1; // Décrément de la stamina en sprint
                if (this.stamina < 0) this.stamina = 0;
            } else if (!this.isSprinting && this.stamina < this.maxStamina) {
                this.stamina += 0.05; // Récupération de la stamina lorsque le joueur ne sprinte pas
                if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
            }

            // Si le joueur est en mouvement, continuez la boucle d'animation
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
