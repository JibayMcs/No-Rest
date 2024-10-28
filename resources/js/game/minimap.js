import mapboxgl from "mapbox-gl";

export function Minimap(options) {
    Object.assign(this.options, options);

    this._parentMap = null;
    this._isDragging = false;
}

Minimap.prototype = Object.assign({}, mapboxgl.NavigationControl.prototype, {
    options: {
        id: 'mapboxgl-minimap',
        width: '180px',
        height: '180px',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [0, 0],
        zoom: 6,

        // should be a function; will be bound to Minimap
        zoomAdjust: null,

        // if parent map zoom >= 18 and minimap zoom >= 14, set minimap zoom to 16
        zoomLevels: [
            [18, 14, 16],
            [16, 12, 14],
            [14, 10, 12],
            [12, 8, 10],
            [10, 6, 8],
        ],

        lineColor: '#08F',
        lineWidth: 1,
        lineOpacity: 1,

        fillColor: '#F80',
        fillOpacity: 0.25,

        dragPan: false,
        scrollZoom: false,
        boxZoom: false,
        dragRotate: false,
        keyboard: false,
        doubleClickZoom: false,
        touchZoomRotate: false,
    },

    onAdd: function (parentMap) {
        this._parentMap = parentMap;

        var opts = this.options;
        var container = (this._container = this._createContainer(parentMap));
        var miniMap = (this._miniMap = new mapboxgl.Map({
            attributionControl: false,
            container: container,
            style: opts.style,
            zoom: opts.zoom,
            center: opts.center,
            accessToken: opts.accessToken,
        }));

        if (opts.maxBounds) miniMap.setMaxBounds(opts.maxBounds);

        miniMap.on('load', this._load.bind(this));

        return this._container;
    },

    _load: function () {
        document.querySelector('#mapboxgl-minimap > .mapboxgl-control-container > .mapboxgl-ctrl-bottom-left').style.display = 'none';

        var opts = this.options;
        var parentMap = this._parentMap;
        var miniMap = this._miniMap;
        var interactions = [
            'dragPan',
            'scrollZoom',
            'boxZoom',
            'dragRotate',
            'keyboard',
            'doubleClickZoom',
            'touchZoomRotate',
        ];

        interactions.forEach(function (i) {
            if (opts[i] !== true) {
                miniMap[i].disable();
            }
        });

        if (typeof opts.zoomAdjust === 'function') {
            this.options.zoomAdjust = opts.zoomAdjust.bind(this);
        } else if (opts.zoomAdjust === null) {
            this.options.zoomAdjust = this._zoomAdjust.bind(this);
        }

        this._playerMarker = new mapboxgl.Marker({ color: 'red', scale: 0.5 })
            .setLngLat([0, 0])
            .addTo(this._miniMap);

        this._update();

        parentMap.on('move', this._update.bind(this));

    },

    _update: function (e) {
        if (this._isDragging) {
            return;
        }

        this._playerMarker.setLngLat(this._parentMap.getCenter());

        if (typeof this.options.zoomAdjust === 'function') {
            this.options.zoomAdjust();
        }
    },

    _zoomAdjust: function () {
        var miniMap = this._miniMap;
        var parentMap = this._parentMap;
        var miniZoom = parseInt(miniMap.getZoom(), 10);
        var parentZoom = parseInt(parentMap.getZoom(), 10);
        var levels = this.options.zoomLevels;
        var found = false;

        levels.forEach(function (zoom) {
            if (!found && parentZoom >= zoom[0]) {
                if (miniZoom >= zoom[1]) {
                    miniMap.setZoom(zoom[2]);
                }

                miniMap.setCenter(parentMap.getCenter());
                found = true;
            }
        });

        if (!found && miniZoom !== this.options.zoom) {
            if (typeof this.options.bounds === 'object') {
                miniMap.fitBounds(this.options.bounds, { duration: 50 });
            }

            miniMap.setZoom(this.options.zoom);
        }
    },

    _createContainer: function (parentMap) {
        var opts = this.options;
        var container = document.createElement('div');

        container.className = 'mapboxgl-ctrl-minimap mapboxgl-ctrl';
        container.setAttribute(
            'style',
            'width: ' + opts.width + '; height: ' + opts.height + ';'
        );
        container.addEventListener('contextmenu', this._preventDefault);

        parentMap.getContainer().appendChild(container);

        if (opts.id !== '') {
            container.id = opts.id;
        }

        return container;
    },

    _preventDefault: function (e) {
        e.preventDefault();
    },
});

mapboxgl.Minimap = Minimap;
