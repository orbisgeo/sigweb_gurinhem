/* ================= Firebase ================= */
const firebaseConfig = {
    apiKey: "AIzaSyDxxxxxxx", // Substitua PELA SUA CHAVE REAL DA API DO FIREBASE
    authDomain: "ruas-gurinhem.firebaseapp.com",
    projectId: "ruas-gurinhem"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ====================================================================
// Habilitar Persistência Offline do Firestore.
// Isso deve ser feito ANTES de qualquer outra chamada ao Firestore.
// ====================================================================
db.enablePersistence()
    .then(() => {
        console.log("Persistência Offline do Firestore habilitada com sucesso!");
        initializeMapAndLayers(); // Chamada à nova função de inicialização
    })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("Múltiplas abas abertas, persistência offline não pode ser habilitada. Funcionará online.");
        } else if (err.code === 'unimplemented') {
            console.warn("O navegador atual não suporta todos os recursos para persistência offline.");
        } else {
            console.error("Erro ao habilitar persistência offline:", err);
        }
        initializeMapAndLayers(); // Ainda assim, inicialize o mapa para funcionar online
    });

// ====================================================================
// EXPOSIÇÃO DE FUNÇÕES GLOBAIS PARA O HTML
// Estas funções são chamadas diretamente pelos 'onclick' no HTML
// e precisam estar no escopo global (window). Elas apenas chamam
// os métodos correspondentes dentro do objeto mapFunctions, que é
// definido em 'initializeMapAndLayers'.
// ====================================================================
let mapFunctions = {}; // Declarado aqui para ser globalmente acessível

// Atribuições diretas para chamadas onclick no HTML
window.toggleMeasureDistance = () => mapFunctions.toggleMeasureDistance();
window.toggleMeasureArea = () => mapFunctions.toggleMeasureArea();
window.clearMeasurements = () => mapFunctions.clearMeasurements();
window.activatePrintMode = () => mapFunctions.activatePrintMode();
window.triggerPrint = () => mapFunctions.triggerPrint();
window.deactivatePrintMode = () => mapFunctions.deactivatePrintMode();
window.mostrarOpcoesExportacao = () => mapFunctions.mostrarOpcoesExportacao();
// REMOVIDO: window.salvarPopupEdicao = (camadaKey, featureId, updatedProps) => mapFunctions.salvarPopupEdicao(camadaKey, featureId, updatedProps);
window.buscarFeicao = () => mapFunctions.buscarFeicao(); // Torna a função de busca acessível globalmente
window.clearSearchHighlight = () => mapFunctions.clearSearchHighlight(); // Torna a função de limpar destaque acessível globalmente


// Função principal para inicializar o mapa e carregar as camadas
function initializeMapAndLayers() {
    /* ================= Variáveis e Configurações Globais do Mapa ================= */
    const osmLayer = new ol.layer.Tile({
        title: "🗺️ OpenStreetMap",
        type: 'base',
        source: new ol.source.OSM(),
        visible: true
    });

    const sateliteLayer = new ol.layer.Tile({
        title: "🛰️ Satélite MapTiler",
        type: 'base',
        source: new ol.source.XYZ({
            url: 'https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=o9sqJVKN8wxu8WXujuRl', // Replace with your MapTiler API Key
            tileSize: 512,  
        }),
        visible: false
    });

    const emptyLayer = new ol.layer.Tile({
        title: "🚫 Sem Base",
        type: 'base',
        source: new ol.source.TileDebug({
            projection: 'EPSG:3857',
            
        }),
        visible: false
    });

    // Adicionado: Definição da projeção EPSG:31985 (SIRGAS 2000 / UTM zone 25S)
    proj4.defs("EPSG:31985", "+proj=utm +zone=25 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
    ol.proj.proj4.register(proj4);

    // Adicionado: Extensão e URL da imagem do drone
    const extentDroneImage = [231844.66068941046, 9210570.410580005, 232802.90551243777, 9211417.585585851];
    const urlDroneImage = 'https://github.com/orbisgeo/DRONE-MAP/blob/main/rib_transparente.png?raw=true';

    // Adicionado: Camada da imagem do drone
    const droneImageLayer = new ol.layer.Image({
        title: "📸 Imagem de Drone", // Título para o controle de camadas
        type: 'overlay', // Tipo 'overlay' para que não seja uma camada base
        source: new ol.source.ImageStatic({
            url: urlDroneImage,
            projection: 'EPSG:31985', // Projeção de origem da imagem
            imageExtent: extentDroneImage,
        }),
        opacity: 1.0, // Opacidade da imagem
        visible: true // Visível por padrão
    });

    // Instancia o controle de escala para poder manipulá-lo
    const scaleLineControl = new ol.control.ScaleLine({
        units: 'metric', // Medidas métricas (m, km)
        bar: true, // Renderiza como barra
        steps: 4, // Número de divisões na barra
        text: true, // Mostra o texto da escala
        minWidth: 140 // Largura mínima da barra para exibir texto
    });

    const map = new ol.Map({
        target: 'map',
        layers: [
            osmLayer,
            sateliteLayer,
            emptyLayer,
            droneImageLayer // Adicionado: Camada da imagem do drone
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([-35.42, -7.12]), // Guarabira, PB, Brazil
            zoom: 16,
            maxZoom: 28,  
            minZoom: 1,  
            projection: 'EPSG:3857' // Garante que a view use a projeção correta para o OSM
        }),
        controls: ol.control.defaults().extend([
            scaleLineControl, // Adiciona o ScaleLine ao mapa
            new ol.control.ZoomSlider()
        ])
    });

    // Adicionado: Ajuste inicial da visualização para encaixar a imagem do drone
    const transformedExtentDrone = ol.proj.transformExtent(extentDroneImage, 'EPSG:31985', 'EPSG:3857');
    map.getView().fit(transformedExtentDrone, {
        size: map.getSize(),
        padding: [50, 50, 50, 50], // Adiciona um pequeno preenchimento
        duration: 1500 // Animação de zoom
    });

    // Get references to core UI elements for show/hide logic
    const mainFormContainer = document.getElementById('mainFormContainer');
    const customLayerControl = document.getElementById('customLayerControl');
    const searchContainer = document.getElementById('searchContainer'); // Novo container de busca
    const printModeControls = document.getElementById('printModeControls');
    const northArrowPrint = document.getElementById('northArrowPrint');

    // Identifica os controles padrão do OpenLayers para esconder no modo impressão
    const olControlsToHide = [
        document.querySelector('.ol-zoom'),
        document.querySelector('.ol-rotate'),  
        document.querySelector('.ol-attribution'),  
    ].filter(Boolean);  

    // Adicionado: Adiciona a camada de drone ao controle de camadas customizado
    map.getLayers().forEach(layer => {
        if (layer.get('type') === 'base') {
            const label = document.createElement('label');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'baseLayer';
            radio.value = layer.get('title');
            radio.checked = layer.getVisible();
            radio.onchange = () => {
                map.getLayers().forEach(l => {
                    if (l.get('type') === 'base') {
                        l.setVisible(l === layer);
                    }
                });
            };
            label.appendChild(radio);
            label.appendChild(document.createTextNode(layer.get('title')));
            customLayerControl.appendChild(label);
        } else if (layer.get('type') === 'overlay') { // Adiciona camadas overlay (como a do drone)
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = layer.getVisible();
            checkbox.onchange = () => layer.setVisible(checkbox.checked);
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(layer.get('title')));
            customLayerControl.appendChild(label);
        }
    });

    /* ================= Camadas GeoData (OpenLayers) ================= */
    const camadas = {
        zona_de_expansao:  { nome: "Zona de Expansao",  cor: "#DAA520", layer: null, source: null },
        ZONA_URBANA:       { nome: "Zona Urbana",       cor: "#8FBC8F", layer: null, source: null },
        BAIRROS_GR:        { nome: "Bairros",           cor: "#DDA0DD", layer: null, source: null },
        QUADRAS_GR:        { nome: "Quadras",           cor: "#BDB76B", layer: null, source: null },
        lotes_rib:         { nome: "Lotes Ribeirão",    cor: "#D2B48C", layer: null, source: null },
        rodovia:           { nome: "Rodovias",          cor: "#FF4500", layer: null, source: null },
        predios_publicos_PMG: { nome: "Predios Publicos", tipo: "ponto", cor: "#000080", layer: null, source: null },
        corpos_hidricos_gr: { nome: "Corpos Hídricos",  cor: "#4682B4", layer: null, source: null },
        ruas_nomeadas:      { nome: "Ruas",             cor: "#A52A2A", layer: null, source: null }
    };

    let selectedFeature = null;
    let selectedFeatureId = null;

    const featureIndex = {}; // Armazena {feature: featureObject, camada: layerKey, props: originalProps}

    let drawInteraction;  
    let modifyInteraction;  

    // Variáveis de Medição
    let measureDraw;
    let measureSource;
    let measureLayer;
    let helpTooltipElement;  
    let helpTooltip;    
    let measureTooltipElement;  
    let measureTooltip;    
    let continuePolygon;
    let continueLine;

    const jstsOlParser = new jsts.io.OL3Parser();  

    // --- Estilos OpenLayers ---
    function getPolygonStyle(color, weight = 1, opacity = 0.5, text = '') {
        let fillColorArray = ol.color.fromString(String(color) || getRandomColor());
        fillColorArray[3] = opacity;  

        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: '#000000',
                width: weight  
            }),
            fill: new ol.style.Fill({
                color: fillColorArray
            }),
            text: text ? getTextStyle(text) : undefined  
        });
    }

    function getPointStyle(color, radius = 6, text = '') {
        return new ol.style.Style({
            image: new ol.style.Circle({
                fill: new ol.style.Fill({ color: String(color) }),  
                stroke: new ol.style.Stroke({ color: '#fff', width: 1 }),
                radius: radius
            }),
            text: text ? getTextStyle(text) : undefined  
        });
    }

    function getTextStyle(text) {
        return new ol.style.Text({
            font: 'bold 11px "Open Sans", "Arial Unicode MS", "sans-serif"',
            fill: new ol.style.Fill({ color: '#000' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 2 }),
            text: text
        });
    }

    async function carregarCamada(key) {
        const cfg = camadas[key];
        const ref = db.collection("GeoData").doc(key).collection("features");
        const snap = await ref.get();

        const features = [];
        snap.forEach(doc => {
            const dados = doc.data();
            const geojson = JSON.parse(dados.geometry);
            const props = dados.properties || {};
            const docId = doc.id;

            const format = new ol.format.GeoJSON();
            const feature = format.readFeature(geojson, {
                dataProjection: 'EPSG:4326',  
                featureProjection: 'EPSG:3857'  
            });
            feature.setId(docId);
            feature.setProperties(props);

            // Inicializa featureIndex com uma cópia limpa das propriedades
            const cleanProps = {};
            for(const pKey in props) {
                if (pKey !== 'geometry' && pKey !== 'id' && pKey !== 'bbox' && pKey !== 'style') {
                    cleanProps[pKey] = props[pKey];
                }
            }
            featureIndex[docId] = { feature: feature, camada: key, props: cleanProps };

            if (props.inscricao_imobiliaria) {
                feature.setStyle((feature, resolution) => {
                    const styleFunction = cfg.tipo === "ponto" ? getPointStyle : getPolygonStyle;
                    return styleFunction(cfg.cor, undefined, undefined, props.inscricao_imobiliaria);
                });
            } else if (props.ordem !== undefined && props.ordem !== null) {
                feature.setStyle((feature, resolution) => {
                    const styleFunction = cfg.tipo === "ponto" ? getPointStyle : getPolygonStyle;
                    return styleFunction(cfg.cor, undefined, undefined, String(props.ordem));
                });
            } else {
                feature.setStyle((feature, resolution) => {
                    const styleFunction = cfg.tipo === "ponto" ? getPointStyle : getPolygonStyle;
                    return styleFunction(cfg.cor);
                });
            }
            
            features.push(feature);
        });

        cfg.source = new ol.source.Vector({ features: features });

        if (cfg.tipo === "ponto") {
            cfg.layer = new ol.layer.Vector({
                title: cfg.nome,
                source: cfg.source,
                renderBuffer: 200,  
                style: (feature) => {
                    const styleFunction = getPointStyle;
                    if (feature.get('inscricao_imobiliaria')) {
                        return styleFunction(cfg.cor, undefined, feature.get('inscricao_imobiliaria'));
                    } else if (feature.get('ordem') !== undefined && feature.get('ordem') !== null) {
                        return styleFunction(cfg.cor, undefined, String(feature.get('ordem')));
                    }
                    return styleFunction(cfg.cor);
                }
            });
        } else {
            cfg.layer = new ol.layer.Vector({
                title: cfg.nome,
                source: cfg.source,
                renderBuffer: 200,  
                style: (feature) => {
                    const styleFunction = getPolygonStyle;
                    if (feature.get('inscricao_imobiliaria')) {
                        return styleFunction(cfg.cor, undefined, undefined, feature.get('inscricao_imobiliaria'));
                    } else if (feature.get('ordem') !== undefined && feature.get('ordem') !== null) {
                        return styleFunction(cfg.cor, undefined, undefined, String(feature.get('ordem')));
                    }
                    return styleFunction(cfg.cor);
                }
            });
        }

        map.addLayer(cfg.layer);

        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;  
        checkbox.onchange = () => cfg.layer.setVisible(checkbox.checked);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(cfg.nome));
        customLayerControl.appendChild(label);
    }

    // Carrega todas as camadas ao inicializar o mapa
    Object.keys(camadas).forEach(carregarCamada);

    const select = new ol.interaction.Select({
        style: new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: '#f00',
                width: 3
            }),
            fill: new ol.style.Fill({
                color: 'rgba(255,0,0,0.2)'
            }),
            image: new ol.style.Circle({
                radius: 8,
                fill: new ol.style.Fill({
                    color: '#f00'
                }),
                stroke: new ol.style.Stroke({
                    color: '#fff',
                    width: 2
                })
            })
        }),
        layers: (layer) => {
            return Object.values(camadas).some(cfg => cfg.layer === layer);
        }
    });
    map.addInteraction(select);

    select.on('select', (event) => {
        if (event.selected.length > 0) {
            selectedFeature = event.selected[0];
            selectedFeatureId = selectedFeature.getId();
        } else {
            selectedFeature = null;
            selectedFeatureId = null;
        }
    });

    const popupElement = document.createElement('div');
    popupElement.className = 'ol-popup';
    popupElement.style.display = 'none'; // Inicialmente oculto
    document.body.appendChild(popupElement);

    const popupOverlay = new ol.Overlay({
        element: popupElement,
        autoPan: true,
        autoPanAnimation: {
            duration: 250
        }
    });
    map.addOverlay(popupOverlay);

    map.on('click', async (event) => {
        const feature = map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
            // Evita abrir popup ao clicar na feição destacada pela busca
            if (feature === currentSearchHighlightFeature) {
                return null;
            }
            return feature;
        });

        if (feature) {
            const featureId = feature.getId();
            const camadaKey = Object.keys(camadas).find(key => camadas[key].layer.getSource().getFeatureById(featureId));

            if (!camadaKey) {
                console.warn("Camada da feição selecionada não encontrada para popup de visualização.");
                return;
            }

            // Usa propriedades de featureIndex para geração consistente do popup
            const featureProps = featureIndex[featureId]?.props || {};

            Swal.fire({
                title: `Atributos: ${camadas[camadaKey]?.nome || 'Desconhecida'}`,
                html: mapFunctions.gerarPopupVisualizacao(featureProps), // CHAMADA AGORA PARA VISUALIZAÇÃO
                focusConfirm: false,
                showCancelButton: false, // REMOVE O BOTÃO DE CANCELAR
                confirmButtonText: 'Fechar', // MUDA O TEXTO DO BOTÃO DE CONFIRMAÇÃO
                position: 'top-end', // Posiciona o popup no canto superior direito
                width: '400px', // Ajusta largura
                backdrop: false, // Permite interação com o mapa por trás
            });
        }
    });

    /* ================= Definição das Funções do Mapa em mapFunctions ================= */
    // REMOVIDA: mapFunctions.salvarAtributos = function() { ... }

    mapFunctions.criarModo = async function() {
        // Esta função pode ser removida se a criação de novos pontos não for permitida.
        // Mantida por enquanto, mas considere se faz sentido em um mapa "somente leitura" de atributos.
        if (drawInteraction) map.removeInteraction(drawInteraction);
        if (modifyInteraction) map.removeInteraction(modifyInteraction);

        const { value: formValues } = await Swal.fire({
            title: 'Novo Prédio',
            html:
                '<input id="swal-nome" class="swal2-input" placeholder="Nome do prédio">' +
                '<input id="swal-tipo" class="swal2-input" placeholder="Tipo">',
            focusConfirm: false,
            showCancelButton: true,
            position: 'top-end', // Posiciona o popup no canto superior direito
            width: '400px', // Ajusta largura
            backdrop: false, // Permite interação com o mapa por trás
            preConfirm: () => {
                const nome = document.getElementById('swal-nome').value;
                const tipo = document.getElementById('swal-tipo').value;
                if (!nome || !tipo) {
                    Swal.showValidationMessage('Por favor, preencha todos os campos');
                    return false;
                }
                return { nome: nome, tipo: tipo };
            }
        });

        if (formValues) {
            const drawSource = new ol.source.Vector();
            const drawLayer = new ol.layer.Vector({
                source: drawSource,
                style: getPointStyle('#0066CC')
            });
            map.addLayer(drawLayer);

            drawInteraction = new ol.interaction.Draw({
                source: drawSource,
                type: 'Point',
            });
            map.addInteraction(drawInteraction);

            Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
            }).fire({
                icon: 'info',
                title: 'Clique no mapa para adicionar o novo ponto.'
            });
            document.body.style.cursor = "crosshair";

            drawInteraction.once('drawend', async (event) => {
                const newFeature = event.feature;
                const coordinates = ol.proj.toLonLat(newFeature.getGeometry().getCoordinates(), 'EPSG:3857');
                const geo = { type: "Point", coordinates: coordinates };
                const props = { NOME: formValues.nome, tipo: formValues.tipo }; // Usa valores do formulário SweetAlert

                try {
                    const docRef = await db.collection("GeoData").doc("predios_publicos_PMG").collection("features").add({
                        geometry: JSON.stringify(geo),
                        properties: props
                    });

                    newFeature.setId(docRef.id);
                    newFeature.setProperties(props);
                    camadas.predios_publicos_PMG.source.addFeature(newFeature);
                    featureIndex[docRef.id] = { feature: newFeature, camada: "predios_publicos_PMG", props: { ...props } }; // Adiciona ao índice

                    drawSource.clear();
                    map.removeInteraction(drawInteraction);
                    map.removeLayer(drawLayer);

                    Swal.fire("✅ Sucesso", "Novo ponto criado!", "success");
                } catch (err) {
                    console.error("Erro ao criar ponto:", err);
                    Swal.fire("❌ Erro", "Não foi possível criar o ponto.", "error");
                }
                document.body.style.cursor = "";
            });
        }
    };

    mapFunctions.apagarPonto = async function() {
        // Esta função também pode ser removida se a exclusão não for permitida.
        if (!selectedFeature || !selectedFeatureId) {
            Swal.fire("Nada selecionado", "Nenhum ponto ou polígono para apagar.", "warning");
            return;
        }

        const c = await Swal.fire({
            title: "Tem certeza?",
            text: "Essa ação não pode ser desfeita!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sim, apagar",
            cancelButtonText: "Cancelar"
        });

        if (c.isConfirmed) {
            try {
                const camadaKey = Object.keys(camadas).find(key => camadas[key].layer.getSource().getFeatureById(selectedFeatureId));
                if (!camadaKey) {
                    Swal.fire("Erro", "Camada da feição selecionada não encontrada.", "error");
                    return;
                }

                await db.collection("GeoData").doc(camadaKey).collection("features").doc(selectedFeatureId).delete();
                camadas[camadaKey].source.removeFeature(selectedFeature);
                delete featureIndex[selectedFeatureId]; // Remove do índice

                selectedFeature = null;
                selectedFeatureId = null;

                Swal.fire("Apagado", "A feição foi removida.", "success");
            } catch (err) {
                console.error("Erro ao apagar ponto:", err);
                Swal.fire("❌ Erro", "Não foi possível apagar a feição.", "error");
            }
        }
    };

    // NOVA FUNÇÃO: Gera o HTML para visualização dos atributos
    mapFunctions.gerarPopupVisualizacao = function(props) {
        let html = `<table class="table-attributes">`;
        // Filtra propriedades internas do OL ao gerar o popup
        for (const key in props) {
            if (key !== 'geometry' && key !== 'id' && key !== 'bbox' && key !== 'style') {
                const value = props[key] !== undefined ? props[key] : 'N/A'; // Usa N/A para valores indefinidos
                html += `
                    <tr>
                        <td><strong>${key}:</strong></td>
                        <td><span class="attribute-value">${value}</span></td>
                    </tr>
                `;
            }
        }
        html += `</table>`;
        return html;
    };

    // REMOVIDA: mapFunctions.salvarPopupEdicao = async function(camadaKey, featureId, updatedProps) { ... }

    /* ==================== Medição de Distância e Área ==================== */
    // Manteve as mensagens de ajuda no tooltip do OL, não no SweetAlert
    mapFunctions.addInteraction = function(type) {
        mapFunctions.clearMeasurements(); // Garante que qualquer medição e rótulo anterior sejam removidos

        measureSource = new ol.source.Vector();
        measureLayer = new ol.layer.Vector({
            source: measureSource,
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(255, 255, 255, 0.2)'
                }),
                stroke: new ol.style.Stroke({
                    color: '#ffcc33',
                    width: 3
                }),
                image: new ol.style.Circle({
                    radius: 7,
                    fill: new ol.style.Fill({
                        color: '#ffcc33'
                    })
                })
            })
        });
        map.addLayer(measureLayer);

        measureDraw = new ol.interaction.Draw({
            source: measureSource,
            type: type,
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(255, 255, 255, 0.2)'
                }),
                stroke: new ol.style.Stroke({
                    color: 'rgba(0, 0, 0, 0.5)',
                    lineDash: [10, 10],
                    width: 2
                }),
                image: new ol.style.Circle({
                    radius: 5,
                    stroke: new ol.style.Stroke({
                        color: 'rgba(0, 0, 0, 0.7)'
                    }),
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 255, 255, 0.2)'
                    })
                })
            })
        });
        map.addInteraction(measureDraw);

        map.on('pointermove', mapFunctions.pointerMoveHandler);

        // Cria ou reutiliza o helpTooltipElement e helpTooltip
        if (!helpTooltipElement) {
            helpTooltipElement = document.createElement('div');
            helpTooltipElement.className = 'ol-tooltip ol-tooltip-help';
            document.body.appendChild(helpTooltipElement);
            helpTooltip = new ol.Overlay({
                element: helpTooltipElement,
                offset: [15, 0],
                positioning: 'center-left'
            });
            map.addOverlay(helpTooltip);
        }
        helpTooltipElement.style.display = 'block'; // Garante que esteja visível

        measureDraw.on('drawstart', function(evt) {
            var sketch = evt.feature;
            var listener = sketch.getGeometry().on('change', function(evt) {
                var geom = evt.target;
                var output;
                if (geom instanceof ol.geom.Polygon) {
                    output = mapFunctions.formatArea(geom);
                    continuePolygon = 'Clique para continuar, clique duplo para finalizar';
                } else if (geom instanceof ol.geom.LineString) {
                    output = mapFunctions.formatLength(geom);
                    continueLine = 'Clique para continuar, clique duplo para finalizar';
                }
                measureTooltipElement.innerHTML = output;
                measureTooltip.setPosition(geom.getLastCoordinate());
            });
            // Cria ou reutiliza o measureTooltipElement e measureTooltip
            if (!measureTooltipElement) {
                measureTooltipElement = document.createElement('div');
                measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';
                document.body.appendChild(measureTooltipElement);
                measureTooltip = new ol.Overlay({
                    element: measureTooltipElement,
                    offset: [0, -15],
                    positioning: 'bottom-center',
                    stopEvent: false,
                    insertFirst: true
                });
                map.addOverlay(measureTooltip);
            }
            measureTooltipElement.style.display = 'block'; // Garante que esteja visível
            measureTooltip.setPosition(evt.coordinate);
        });

        measureDraw.on('drawend', function() {
            measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
            measureTooltip.setOffset([0, -7]);
            // unset sketch
            measureTooltipElement = null;
            measureTooltip = null;
            // Oculta helpTooltip após a medição ser finalizada
            helpTooltipElement.style.display = 'none';
            map.un('pointermove', mapFunctions.pointerMoveHandler); // Remove o handler de movimento do mouse

            // Remove a interação de desenho após finalizar
            map.removeInteraction(measureDraw);
            measureDraw = null;
        });
    };

    mapFunctions.pointerMoveHandler = function(evt) {
        if (evt.dragging) {
            return;
        }
        /** @type {string} */
        var helpMsg = 'Clique para começar a desenhar';
        if (measureDraw) {
            var geom = measureDraw.get('geometry');
            if (geom) {
                if (geom instanceof ol.geom.Polygon) {
                    helpMsg = continuePolygon;
                } else if (geom instanceof ol.geom.LineString) {
                    helpMsg = continueLine;
                }
            }
        }
        if (helpTooltipElement) {
            helpTooltipElement.innerHTML = helpMsg;
            helpTooltip.setPosition(evt.coordinate);
        }
    };

    mapFunctions.formatLength = function(line) {
        const length = ol.sphere.getLength(line, { projection: 'EPSG:3857' });
        let output;
        if (length > 100) {
            output = (Math.round(length / 1000 * 100) / 100) + ' ' + 'km';
        } else {
            output = (Math.round(length * 100) / 100) + ' ' + 'm';
        }
        return output;
    };

    mapFunctions.formatArea = function(polygon) {
        const area = ol.sphere.getArea(polygon, { projection: 'EPSG:3857' });
        let output;
        if (area > 10000) {
            output = (Math.round(area / 1000000 * 100) / 100) + ' ' + 'km²';
        } else {
            output = (Math.round(area * 100) / 100) + ' ' + 'm²';
        }
        return output;
    };

    mapFunctions.toggleMeasureDistance = function() {
        if (measureDraw && measureDraw.get('type') === 'LineString') {
            mapFunctions.clearMeasurements();
        } else {
            mapFunctions.addInteraction('LineString');
        }
    };

    mapFunctions.toggleMeasureArea = function() {
        if (measureDraw && measureDraw.get('type') === 'Polygon') {
            mapFunctions.clearMeasurements();
        } else {
            mapFunctions.addInteraction('Polygon');
        }
    };

    mapFunctions.clearMeasurements = function() {
        if (measureDraw) {
            map.removeInteraction(measureDraw);
            measureDraw = null;
        }
        if (measureSource) {
            measureSource.clear();
        }
        if (measureLayer) {
            map.removeLayer(measureLayer);
            measureLayer = null;
        }
        if (helpTooltipElement) {
            helpTooltipElement.style.display = 'none';
        }
        if (measureTooltipElement) {
            measureTooltipElement.style.display = 'none';
        }
        map.un('pointermove', mapFunctions.pointerMoveHandler); // Garante que o handler seja removido
    };


    /* ==================== Funcionalidades de Impressão ==================== */
    mapFunctions.activatePrintMode = function() {
        document.body.classList.add('print-mode-active');
        map.getTargetElement().classList.add('print-mode-active');
        printModeControls.style.display = 'flex'; // Exibe os controles de impressão
        northArrowPrint.style.display = 'block'; // Mostra a seta do norte

        // Esconde outros controles da UI
        mainFormContainer.classList.add('hidden-for-print');
        customLayerControl.classList.add('hidden-for-print');
        searchContainer.classList.add('hidden-for-print'); // Esconde o container de busca

        // Esconde os controles padrão do OpenLayers
        olControlsToHide.forEach(ctrl => {
            if (ctrl) ctrl.classList.add('hidden-for-print');
        });

        // Torna a escala visível e ajusta a posição para o modo de impressão
        scaleLineControl.element.classList.add('visible-for-print');
    };

    mapFunctions.deactivatePrintMode = function() {
        document.body.classList.remove('print-mode-active');
        map.getTargetElement().classList.remove('print-mode-active');
        printModeControls.style.display = 'none'; // Oculta os controles de impressão
        northArrowPrint.style.display = 'none'; // Oculta a seta do norte

        // Mostra os outros controles da UI
        mainFormContainer.classList.remove('hidden-for-print');
        customLayerControl.classList.remove('hidden-for-print');
        searchContainer.classList.remove('hidden-for-print'); // Mostra o container de busca

        // Mostra os controles padrão do OpenLayers
        olControlsToHide.forEach(ctrl => {
            if (ctrl) ctrl.classList.remove('hidden-for-print');
        });

        // Oculta a escala novamente
        scaleLineControl.element.classList.remove('visible-for-print');
    };

    mapFunctions.triggerPrint = function() {
        window.print();
    };


    /* ==================== Funcionalidades de Exportação (KML) ==================== */

    mapFunctions.mostrarOpcoesExportacao = async function() {
        const { value: camadaKey } = await Swal.fire({
            title: 'Exportar Camada para KML',
            input: 'select',
            inputOptions: Object.keys(camadas).reduce((acc, key) => {
                acc[key] = camadas[key].nome;
                return acc;
            }, {}),
            inputPlaceholder: 'Selecione a camada',
            showCancelButton: true,
            inputValidator: (value) => {
                return new Promise((resolve) => {
                    if (value) {
                        resolve();
                    } else {
                        resolve('Você precisa selecionar uma camada!');
                    }
                });
            }
        });

        if (camadaKey) {
            const layerToExport = camadas[camadaKey].layer;
            if (!layerToExport || !layerToExport.getSource().getFeatures().length) {
                Swal.fire('Erro', `A camada "${camadas[camadaKey].nome}" não possui feições para exportar ou não foi carregada.`, 'error');
                return;
            }

            Swal.fire({
                title: 'Opções de Projeção',
                html:
                    '<input type="radio" id="proj4326" name="projection" value="EPSG:4326" checked>' +
                    '<label for="proj4326">WGS84 (Lat/Lon)</label><br>' +
                    '<input type="radio" id="proj31985" name="projection" value="EPSG:31985">' +
                    '<label for="proj31985">SIRGAS 2000 / UTM zone 25S (EPSG:31985)</label>',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Exportar',
                preConfirm: () => {
                    const selectedProjection = document.querySelector('input[name="projection"]:checked').value;
                    return selectedProjection;
                }
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const targetProjection = result.value;
                    mapFunctions.exportLayerToKML(camadaKey, targetProjection);
                }
            });
        }
    };

    mapFunctions.exportLayerToKML = function(camadaKey, targetProjection) {
        const layer = camadas[camadaKey].layer;
        const features = layer.getSource().getFeatures();
        
        // Transforma as feições para a projeção desejada antes de exportar
        const transformedFeatures = features.map(feature => {
            const clonedFeature = feature.clone(); // Clona para não modificar a feição original
            const geometry = clonedFeature.getGeometry();
            if (geometry) {
                // Transforma apenas se a projeção de origem for diferente da de destino
                if (map.getView().getProjection().getCode() !== targetProjection) {
                    geometry.transform(map.getView().getProjection(), targetProjection);
                }
            }
            return clonedFeature;
        });

        const format = new ol.format.KML({
            // Definições de writeFeatures
            // dataProjection: targetProjection, // A projeção dos dados que estão sendo escritos
            // featureProjection: 'EPSG:3857' // A projeção das feições no mapa (já transformadas acima)
        });

        // KML sempre usa WGS84 (EPSG:4326) internamente para as coordenadas.
        // A transformação para o targetProjection é feita ANTES do KML writer.
        const kmlString = format.writeFeatures(transformedFeatures, {
            dataProjection: 'EPSG:4326', // KML specification is WGS84
            featureProjection: targetProjection, // Our features are now in this projection
            // writeStyles: true // Se tiver estilos OL que queira converter para KML, mas é complexo
        });

        const blob = new Blob([kmlString], { type: 'application/vnd.google-earth.kml+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${camadas[camadaKey].nome.replace(/\s+/g, '_')}_export.kml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Swal.fire('Sucesso!', `Camada "${camadas[camadaKey].nome}" exportada como KML.`, 'success');
    };

    /* ==================== Funcionalidade de Busca de Feições ==================== */
    const camadaSelect = document.getElementById('camadaSelect');
    const campoSelect = document.getElementById('campoSelect');
    const valorBuscaInput = document.getElementById('valorBusca');
    const sugestoesDiv = document.getElementById('sugestoes');

    let currentSearchHighlightFeature = null;
    let originalFeatureStyle = null;

    // Popula o select de camadas
    Object.keys(camadas).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = camadas[key].nome;
        camadaSelect.appendChild(option);
    });

    // Event listener para mudança de camada
    camadaSelect.addEventListener('change', () => {
        mapFunctions.populateCampoSelect(camadaSelect.value);
        valorBuscaInput.value = ''; // Limpa o valor de busca ao mudar a camada
        sugestoesDiv.style.display = 'none'; // Esconde sugestões
    });

    // Popula o select de campos com base na camada selecionada
    mapFunctions.populateCampoSelect = function(camadaKey) {
        campoSelect.innerHTML = ''; // Limpa opções anteriores
        const camadaData = camadas[camadaKey];
        if (camadaData && camadaData.source) {
            // Pega a primeira feição da camada para inferir os campos disponíveis
            const firstFeature = camadaData.source.getFeatures()[0];
            if (firstFeature) {
                const properties = firstFeature.getProperties();
                const defaultOption = document.createElement('option');
                defaultOption.value = "";
                defaultOption.textContent = "Selecione um campo...";
                campoSelect.appendChild(defaultOption);

                for (const key in properties) {
                    // Ignora propriedades internas do OpenLayers e propriedades de geometria/estilo
                    if (key !== 'geometry' && key !== 'id' && key !== 'bbox' && key !== 'style') {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = key; // Ou um nome mais amigável, se houver um mapeamento
                        campoSelect.appendChild(option);
                    }
                }
            } else {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "Nenhum campo disponível";
                campoSelect.appendChild(option);
            }
        }
    };

    // Inicializa o select de campos para a camada padrão
    mapFunctions.populateCampoSelect(camadaSelect.value);

    // Event listener para input de busca com autocompletar
    valorBuscaInput.addEventListener('input', () => {
        const query = valorBuscaInput.value.toLowerCase();
        const camadaKey = camadaSelect.value;
        const campoKey = campoSelect.value;

        sugestoesDiv.innerHTML = '';
        sugestoesDiv.style.display = 'none';

        if (query.length < 2 || !camadaKey || !campoKey) {
            return;
        }

        const camadaData = camadas[camadaKey];
        if (camadaData && camadaData.source) {
            const allFeatures = camadaData.source.getFeatures();
            const suggestions = new Set(); // Usa Set para evitar duplicatas

            allFeatures.forEach(feature => {
                const value = feature.get(campoKey);
                if (value !== undefined && value !== null) {
                    const stringValue = String(value).toLowerCase();
                    if (stringValue.includes(query)) {
                        suggestions.add(String(value)); // Adiciona o valor original, não o toLowerCase
                    }
                }
            });

            if (suggestions.size > 0) {
                suggestions.forEach(sugestao => {
                    const item = document.createElement('div');
                    item.className = 'sugestao-item';
                    item.textContent = sugestao;
                    item.addEventListener('click', () => {
                        valorBuscaInput.value = sugestao;
                        sugestoesDiv.style.display = 'none';
                        mapFunctions.buscarFeicao(); // Dispara a busca ao selecionar sugestão
                    });
                    sugestoesDiv.appendChild(item);
                });
                sugestoesDiv.style.display = 'block';
            }
        }
    });

    // Ocultar sugestões ao clicar fora
    document.addEventListener('click', (event) => {
        if (!sugestoesDiv.contains(event.target) && event.target !== valorBuscaInput) {
            sugestoesDiv.style.display = 'none';
        }
    });


    mapFunctions.buscarFeicao = async function() {
        Swal.fire({
            title: 'Buscando...',
            text: 'Por favor, aguarde.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        mapFunctions.clearSearchHighlight(); // Limpa destaque anterior

        const camadaKey = camadaSelect.value;
        const campoKey = campoSelect.value;
        const valorBusca = valorBuscaInput.value;

        if (!camadaKey || !campoKey || !valorBusca) {
            Swal.close();
            Swal.fire('Aviso', 'Por favor, selecione uma camada, um campo e digite um valor para buscar.', 'warning');
            return;
        }

        const camadaData = camadas[camadaKey];
        if (!camadaData || !camadaData.source) {
            Swal.close();
            Swal.fire('Erro', 'Dados da camada não disponíveis.', 'error');
            return;
        }

        try {
            const features = camadaData.source.getFeatures();
            const foundFeature = features.find(feature => {
                const attributeValue = feature.get(campoKey);
                // Converte para string para comparação robusta
                return attributeValue !== undefined && attributeValue !== null &&
                       String(attributeValue).toLowerCase() === String(valorBusca).toLowerCase();
            });

            if (foundFeature) {
                currentSearchHighlightFeature = foundFeature;
                originalFeatureStyle = foundFeature.getStyle(); // Salva o estilo original

                // Estilo de destaque
                const highlightStyle = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: '#FFFF00', // Amarelo
                        width: 5
                    }),
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 255, 0, 0.4)' // Amarelo semi-transparente
                    }),
                    image: new ol.style.Circle({
                        radius: 10,
                        fill: new ol.style.Fill({
                            color: '#FFFF00'
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#FFFFFF',
                            width: 2
                        })
                    })
                });
                foundFeature.setStyle(highlightStyle);

                // Centraliza e dá zoom na feição
                const geometry = foundFeature.getGeometry();
                if (geometry) {
                    const extent = geometry.getExtent();
                    map.getView().fit(extent, {
                        size: map.getSize(),
                        padding: [100, 100, 100, 100], // Margem em pixels
                        duration: 1000 // Animação de 1 segundo
                    });
                }
                Swal.close();
                Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 5000,
                    timerProgressBar: true,
                }).fire({
                    icon: 'success',
                    title: `Feição encontrada na camada "${camadas[camadaKey].nome}"!`
                });
            } else {
                Swal.close();
                Swal.fire('Não Encontrado', 'Feição não encontrada no cache local ou dados inconsistentes.', 'info', {
                    position: 'top-end', backdrop: false
                });
            }
        } catch (error) {
            console.error("Erro ao buscar feição:", error);
            Swal.close();
            Swal.fire('Erro na Busca', `Ocorreu um erro ao buscar a feição: ${error.message}`, 'error', {
                position: 'top-end', backdrop: false
            });
        }
    };

    mapFunctions.clearSearchHighlight = function() {
        if (currentSearchHighlightFeature) {
            currentSearchHighlightFeature.setStyle(originalFeatureStyle); // Restaura o estilo original
            currentSearchHighlightFeature = null;
            originalFeatureStyle = null;
        }
    };


    /* ================= Utilidades ================= */
    function getRandomColor() { return '#' + Math.floor(Math.random() * 16777215).toString(16); }

} // Fim da função initializeMapAndLayers
