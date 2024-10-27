export default class Player {
    position = {};
    inventory = {};
    skinColor = '#f8d9b6';
    showInventory = false;
    maxHealth = 100;
    health = 100;

    init() {
        this.loadPosition();

        // Initialiser ou charger l'inventaire depuis le localStorage
        this.loadInventory();
    }

    // Charger la position du joueur depuis le localStorage
    loadPosition() {
        console.log(map);
        const savedPosition = localStorage.getItem('playerPosition');
        this.position = savedPosition ? JSON.parse(savedPosition) : this.position = {lat: 46.142976, lng: -0.797463};

        if(!savedPosition) {
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
        // Affiche ou masque l'inventaire lors de l'appui sur "I"
        if (event.key === 'i' || event.key === 'I') {
            this.showInventory = !this.showInventory;
        }

        if (this.showInventory && event.key === 'Escape') {
            this.showInventory = false
        }
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
