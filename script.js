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
// ====================================================================
db.enablePersistence()
    .then(() => {
        console.log("Persistência Offline do Firestore habilitada com sucesso!");
        initializeMapAndLayers();
    })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("Múltiplas abas abertas, persistência offline não pode ser habilitada. Funcionará online.");
        } else if (err.code === 'unimplemented') {
            console.warn("O navegador atual não suporta todos os recursos para persistência offline.");
        } else {
            console.error("Erro ao habilitar persistência offline:", err);
        }
        initializeMapAndLayers();
    });

// ====================================================================
// EXPOSIÇÃO DE FUNÇÕES GLOBAIS PARA O HTML
// ====================================================================
let mapFunctions = {};

window.toggleMeasureDistance = () => mapFunctions.toggleMeasureDistance();
window.toggleMeasureArea = () => mapFunctions.toggleMeasureArea();
window.clearMeasurements = () => mapFunctions.clearMeasurements();
window.activatePrintMode = () => mapFunctions.activatePrintMode();
window.triggerPrint = () => mapFunctions.triggerPrint();
window.deactivatePrintMode = () => mapFunctions.deactivatePrintMode();
window.mostrarOpcoesExportacao = () => mapFunctions.mostrarOpcoesExportacao();
window.buscarFeicao = () => mapFunctions.buscarFeicao();
window.clearSearchHighlight = () => mapFunctions.clearSearchHighlight();

// **IMPORTANTE**: Garanta que 'overlay', 'content' e 'closer' sejam acessíveis globalmente
// ou passados como parâmetros se initializeMapAndLayers não for a primeira a ser chamada
// e eles forem definidos no script do HTML.
// No setup atual com o HTML fornecido, eles são globais.

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
            url: 'https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=o9sqJVKN8wxu8WXujuRl',
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

    proj4.defs("EPSG:31985", "+proj=utm +zone=25 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
    ol.proj.proj4.register(proj4);

    const extentDroneImage = [231844.66068941046, 9210570.410580005, 232802.90551243777, 9211417.585585851];
    const urlDroneImage = 'https://github.com/orbisgeo/DRONE-MAP/blob/main/rib_transparente.png?raw=true';

    const droneImageLayer = new ol.layer.Image({
        title: "📸 Imagem de Drone",
        type: 'overlay',
        source: new ol.source.ImageStatic({
            url: urlDroneImage,
            projection: 'EPSG:31985',
            imageExtent: extentDroneImage,
        }),
        opacity: 1.0,
        visible: true
    });

    const scaleLineControl = new ol.control.ScaleLine({
        units: 'metric',
        bar: true,
        steps: 4,
        text: true,
        minWidth: 140
    });

    const map = new ol.Map({
        target: 'map',
        layers: [osmLayer, sateliteLayer, emptyLayer, droneImageLayer],
        view: new ol.View({
            center: ol.proj.fromLonLat([-35.42, -7.12]),
            zoom: 16,
            maxZoom: 28,
            minZoom: 1,
            projection: 'EPSG:3857'
        }),
        controls: ol.control.defaults().extend([
            scaleLineControl,
            new ol.control.ZoomSlider()
        ])
    });

    // Adiciona o overlay do popup ao mapa AQUI
    if (typeof overlay !== 'undefined') { // Garante que a variável 'overlay' do HTML exista
        map.addOverlay(overlay);
    } else {
        console.error("Variável 'overlay' não encontrada. Verifique se o script do HTML foi carregado corretamente.");
    }


    const transformedExtentDrone = ol.proj.transformExtent(extentDroneImage, 'EPSG:31985', 'EPSG:3857');
    map.getView().fit(transformedExtentDrone, {
        size: map.getSize(),
        padding: [50, 50, 50, 50],
        duration: 1500
    });

    // ====================================================================
    // Referências aos elementos da UI
    // ====================================================================
    const toolsPanel = document.getElementById('tools-panel');
    const searchPanel = document.getElementById('search-panel');
    const layerControlPanel = document.getElementById('customLayerControl');
    const layerContentContainer = document.getElementById('customLayerContent');

    const printModeControls = document.getElementById('printModeControls');
    const northArrowPrint = document.getElementById('northArrowPrint');

    const olControlsToHide = [
        document.querySelector('.ol-zoom'),
        document.querySelector('.ol-rotate'),
        document.querySelector('.ol-attribution'),
    ].filter(Boolean);

    // Popula o controle de camadas customizado
    map.getLayers().forEach(layer => {
        const title = layer.get('title');
        if (!title) return; // Pula camadas sem título

        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = layer.get('type') === 'base' ? 'radio' : 'checkbox';

        if (input.type === 'radio') {
            input.name = 'baseLayer';
            input.value = title;
            input.checked = layer.getVisible();
            input.onchange = () => {
                map.getLayers().forEach(l => {
                    if (l.get('type') === 'base') {
                        l.setVisible(l.get('title') === title);
                    }
                });
            };
        } else {
            input.checked = layer.getVisible();
            input.onchange = () => layer.setVisible(input.checked);
        }

        label.appendChild(input);
        label.appendChild(document.createTextNode(' ' + title));
        layerContentContainer.appendChild(label);
    });

    /* ================= Camadas GeoData (OpenLayers) ================= */
    const camadas = {
        zona_de_expansao: { nome: "Zona de Expansao", cor: "#DAA520", layer: null, source: null },
        ZONA_URBANA: { nome: "Zona Urbana", cor: "#8FBC8F", layer: null, source: null },
        BAIRROS_GR: { nome: "Bairros", cor: "#DDA0DD", layer: null, source: null },
        QUADRAS_GR: { nome: "Quadras", cor: "#BDB76B", layer: null, source: null },
        lotes_rib: { nome: "Lotes Ribeirão", cor: "#D2B48C", layer: null, source: null },
        rodovia: { nome: "Rodovias", cor: "#FF4500", layer: null, source: null },
        predios_publicos_PMG: { nome: "Predios Publicos", tipo: "ponto", cor: "#000080", layer: null, source: null },
        corpos_hidricos_gr: { nome: "Corpos Hídricos", cor: "#4682B4", layer: null, source: null },
        ruas_nomeadas: { nome: "Ruas", cor: "#A52A2A", layer: null, source: null }
    };

    let selectedFeature = null;
    let selectedFeatureId = null;
    const featureIndex = {};
    let drawInteraction;
    let modifyInteraction;

    // Variáveis de Medição
    let measureDraw, measureSource, measureLayer, helpTooltipElement, helpTooltip, measureTooltipElement, measureTooltip, continuePolygon, continueLine;

    const jstsOlParser = new jsts.io.OL3Parser();

    // --- Estilos OpenLayers ---
    function getPolygonStyle(color, weight = 1, opacity = 0.5, text = '') {
        let fillColorArray = ol.color.fromString(String(color) || getRandomColor());
        fillColorArray[3] = opacity;
        return new ol.style.Style({
            stroke: new ol.style.Stroke({ color: '#000000', width: weight }),
            fill: new ol.style.Fill({ color: fillColorArray }),
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

            const cleanProps = {};
            for (const pKey in props) {
                if (pKey !== 'geometry' && pKey !== 'id' && pKey !== 'bbox' && pKey !== 'style') {
                    cleanProps[pKey] = props[pKey];
                }
            }
            featureIndex[docId] = { feature: feature, camada: key, props: cleanProps };

            const styleFunction = cfg.tipo === "ponto" ? getPointStyle : getPolygonStyle;
            let labelText = '';
            if (props.inscricao_imobiliaria) {
                labelText = props.inscricao_imobiliaria;
            } else if (props.ordem !== undefined && props.ordem !== null) {
                labelText = String(props.ordem);
            }
            feature.setStyle(styleFunction(cfg.cor, undefined, undefined, labelText));

            features.push(feature);
        });

        cfg.source = new ol.source.Vector({ features: features });
        cfg.layer = new ol.layer.Vector({
            title: cfg.nome,
            source: cfg.source,
            renderBuffer: 200,
        });

        map.addLayer(cfg.layer);

        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.onchange = () => cfg.layer.setVisible(checkbox.checked);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + cfg.nome));
        layerContentContainer.appendChild(label);
    }

    Object.keys(camadas).forEach(carregarCamada);

    const select = new ol.interaction.Select({
        style: new ol.style.Style({
            stroke: new ol.style.Stroke({ color: '#f00', width: 3 }),
            fill: new ol.style.Fill({ color: 'rgba(255,0,0,0.2)' }),
            image: new ol.style.Circle({
                radius: 8,
                fill: new ol.style.Fill({ color: '#f00' }),
                stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
            })
        }),
        layers: (layer) => Object.values(camadas).some(cfg => cfg.layer === layer)
    });
    map.addInteraction(select);

    select.on('select', (event) => {
        selectedFeature = event.selected.length > 0 ? event.selected[0] : null;
        selectedFeatureId = selectedFeature ? selectedFeature.getId() : null;
    });

    let currentSearchHighlightFeature = null;

    map.on('click', async (event) => {
        // Verifica se o clique foi no popup. Se sim, não faz nada para evitar recursão ou fechamento indesejado.
        const clickedElement = map.getTargetElement().querySelector('.map-popup-content');
        if (clickedElement && clickedElement.contains(event.originalEvent.target)) {
            return;
        }

        const feature = map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
            // Ignora a feature de highlight de busca se clicada novamente
            if (feature === currentSearchHighlightFeature) return null;
            return feature;
        });

        if (feature) {
            const featureId = feature.getId();
            const camadaKey = Object.keys(camadas).find(key => camadas[key].layer && camadas[key].layer.getSource().getFeatureById(featureId));
            if (!camadaKey) {
                // Se a feição não está em uma das camadas controladas, fecha o popup se estiver aberto
                overlay.setPosition(undefined);
                return;
            }

            const featureProps = featureIndex[featureId]?.props || {};
            
            // --- GERAÇÃO DO HTML DO POPUP COM OS NOVOS RÓTULOS E FORMATAÇÕES ---
            // Função auxiliar para traduzir o ID da cobertura
            const getCoverageType = (id) => {
                if (id === 1 || id === '1') {
                    return 'Telha';
                } else if (id === 2 || id === '2') {
                    return 'Laje';
                }
                return ''; // Retorna vazio se não for 1 nem 2
            };

            // Mapeamento de nomes de campos para rótulos amigáveis
            const fieldLabels = {
                nm_conj: 'Nome do Cônjuge',
                bairro: 'Bairro',
                area_construida_2: 'Área Construída',
                AREA_LOTE: 'Área do Lote',
                lote: 'Lote',
                id_0: 'ID_0',
                nm_prop: 'Nome do Proprietário',
                cpf_conj: 'CPF do Cônjuge',
                quadra: 'Quadra',
                cpf_prop: 'CPF do Proprietário',
                data_io: 'Ano de Início da Ocupação',
                'ocup_%': 'Porcentagem de ocupação do lote', // Use aspas para chaves com caracteres especiais
                inscricao_imobiliaria: 'Inscrição Imobiliária',
                id_lote: 'ID do Lote',
                pavimentos: 'Número de Pavimentos',
                estado_civil: 'Estado Civil',
                id_cobertura: 'Tipo de Cobertura' // Este será tratado especialmente
            };

            let popupHtml = `
                <div class="popup-header">
                    <span class="popup-title">ID: ${featureId}</span>
                </div>
                <div class="form-section-header">Informações do Proprietário</div>
                <div class="form-section">
                    <div class="form-group">
                        <label for="ownerName">${fieldLabels.nm_prop || 'Nome do Proprietário'}</label>
                        <input type="text" id="ownerName" value="${featureProps.nm_prop || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="ownerCPF">${fieldLabels.cpf_prop || 'CPF do Proprietário'}</label>
                        <input type="text" id="ownerCPF" value="${featureProps.cpf_prop || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="ownerConjName">${fieldLabels.nm_conj || 'Nome do Cônjuge'}</label>
                        <input type="text" id="ownerConjName" value="${featureProps.nm_conj || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="ownerConjCPF">${fieldLabels.cpf_conj || 'CPF do Cônjuge'}</label>
                        <input type="text" id="ownerConjCPF" value="${featureProps.cpf_conj || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="maritalStatus">${fieldLabels.estado_civil || 'Estado Civil'}</label>
                        <select id="maritalStatus" readonly>
                            <option value="">Selecione...</option>
                            <option value="Solteiro(a)" ${featureProps.estado_civil === 'Solteiro(a)' ? 'selected' : ''}>Solteiro(a)</option>
                            <option value="Casado(a)" ${featureProps.estado_civil === 'Casado(a)' ? 'selected' : ''}>Casado(a)</option>
                            <option value="Divorciado(a)" ${featureProps.estado_civil === 'Divorciado(a)' ? 'selected' : ''}>Divorciado(a)</option>
                            <option value="Viúvo(a)" ${featureProps.estado_civil === 'Viúvo(a)' ? 'selected' : ''}>Viúvo(a)</option>
                            <option value="${featureProps.estado_civil}" ${!['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)'].includes(featureProps.estado_civil) && featureProps.estado_civil ? 'selected' : ''} style="display: ${!['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)'].includes(featureProps.estado_civil) && featureProps.estado_civil ? 'block' : 'none'};">${featureProps.estado_civil || ''}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="occupationYear">${fieldLabels.data_io || 'Ano de Início da Ocupação'}</label>
                        <select id="occupationYear" readonly>
                            <option value="">Selecione o Ano...</option>
                            ${Array.from({ length: new Date().getFullYear() - 1900 + 11 }, (_, i) => 1900 + i)
                                .map(year => `<option value="${year}" ${featureProps.data_io == year ? 'selected' : ''}>${year}</option>`)
                                .join('')}
                            ${featureProps.data_io && !Array.from({ length: new Date().getFullYear() - 1900 + 11 }, (_, i) => 1900 + i).includes(parseInt(featureProps.data_io)) ? `<option value="${featureProps.data_io}" selected>${featureProps.data_io}</option>` : ''}
                        </select>
                    </div>
                </div>

                <div class="form-section-header">Informações da Propriedade</div>
                <div class="form-section">
                    <div class="form-group">
                        <label for="propertyNeighborhood">${fieldLabels.bairro || 'Bairro'}</label>
                        <input type="text" id="propertyNeighborhood" value="${featureProps.bairro || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="propertyBlock">${fieldLabels.quadra || 'Quadra'}</label>
                        <input type="text" id="propertyBlock" value="${featureProps.quadra || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="propertyLot">${fieldLabels.lote || 'Lote'}</label>
                        <input type="text" id="propertyLot" value="${featureProps.lote || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="propertyFloors">${fieldLabels.pavimentos || 'Número de Pavimentos'}</label>
                        <input type="text" id="propertyFloors" value="${featureProps.pavimentos || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="lotArea">${fieldLabels.AREA_LOTE || 'Área do Lote'}</label>
                        <input type="text" id="lotArea" value="${featureProps.AREA_LOTE || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="builtArea">${fieldLabels.area_construida_2 || 'Área Construída'}</label>
                        <input type="text" id="builtArea" value="${featureProps.area_construida_2 || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="occupancyPercentage">${fieldLabels['ocup_%'] || 'Porcentagem de ocupação do lote'}</label>
                        <input type="text" id="occupancyPercentage" value="${featureProps['ocup_%'] !== undefined && featureProps['ocup_%'] !== null ? featureProps['ocup_%'] + '%' : ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="coverageType">${fieldLabels.id_cobertura || 'Tipo de Cobertura'}</label>
                        <input type="text" id="coverageType" value="${getCoverageType(featureProps.id_cobertura)}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="propertyId">${fieldLabels.inscricao_imobiliaria || 'Inscrição Imobiliária'}</label>
                        <input type="text" id="propertyId" value="${featureProps.inscricao_imobiliaria || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="lotId">${fieldLabels.id_lote || 'ID do Lote'}</label>
                        <input type="text" id="lotId" value="${featureProps.id_lote || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="id0">${fieldLabels.id_0 || 'ID_0'}</label>
                        <input type="text" id="id0" value="${featureProps.id_0 || ''}" readonly>
                    </div>
                </div>
                <div style="padding: var(--spacing-lg); text-align: center;">
                    <button class="btn btn-primary btn-save-changes">Salvar Alterações</button>
                </div>
            `;
            // --- FIM DA GERAÇÃO DO HTML DO POPUP ---

            // 'content' é o div interno do popup definido no HTML
            if (typeof content !== 'undefined') {
                content.innerHTML = popupHtml;
                // 'overlay' é o ol.Overlay definido no HTML
                overlay.setPosition(event.coordinate);
            } else {
                console.error("Variáveis 'content' ou 'overlay' não encontradas. O popup não será exibido.");
                // Como fallback, se o overlay não estiver disponível, exibe no SweetAlert2
                Swal.fire({
                    title: `Atributos: ${camadas[camadaKey]?.nome || 'Desconhecida'}`,
                    html: `
                        <div class="table-container">
                            <table class="table-attributes">
                                <tr><td><strong>${fieldLabels.nm_prop || 'Nome do Proprietário'}:</strong></td><td>${featureProps.nm_prop || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.cpf_prop || 'CPF do Proprietário'}:</strong></td><td>${featureProps.cpf_prop || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.nm_conj || 'Nome do Cônjuge'}:</strong></td><td>${featureProps.nm_conj || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.cpf_conj || 'CPF do Cônjuge'}:</strong></td><td>${featureProps.cpf_conj || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.estado_civil || 'Estado Civil'}:</strong></td><td>${featureProps.estado_civil || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.data_io || 'Ano de Início da Ocupação'}:</strong></td><td>${featureProps.data_io || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.bairro || 'Bairro'}:</strong></td><td>${featureProps.bairro || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.quadra || 'Quadra'}:</strong></td><td>${featureProps.quadra || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.lote || 'Lote'}:</strong></td><td>${featureProps.lote || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.pavimentos || 'Número de Pavimentos'}:</strong></td><td>${featureProps.pavimentos || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.AREA_LOTE || 'Área do Lote'}:</strong></td><td>${featureProps.AREA_LOTE || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.area_construida_2 || 'Área Construída'}:</strong></td><td>${featureProps.area_construida_2 || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels['ocup_%'] || 'Porcentagem de ocupação do lote'}:</strong></td><td>${featureProps['ocup_%'] !== undefined && featureProps['ocup_%'] !== null ? featureProps['ocup_%'] + '%' : 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.id_cobertura || 'Tipo de Cobertura'}:</strong></td><td>${getCoverageType(featureProps.id_cobertura) || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.inscricao_imobiliaria || 'Inscrição Imobiliária'}:</strong></td><td>${featureProps.inscricao_imobiliaria || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.id_lote || 'ID do Lote'}:</strong></td><td>${featureProps.id_lote || 'N/A'}</td></tr>
                                <tr><td><strong>${fieldLabels.id_0 || 'ID_0'}:</strong></td><td>${featureProps.id_0 || 'N/A'}</td></tr>
                            </table>
                        </div>
                    `,
                    focusConfirm: false,
                    showCancelButton: false,
                    confirmButtonText: 'Fechar',
                    position: 'top-end',
                    width: '400px',
                    backdrop: false,
                });
            }

        } else {
            // Se não clicou em nenhuma feição, esconde o popup
            if (typeof overlay !== 'undefined') {
                overlay.setPosition(undefined);
            }
        }
    });

    // Removi a função gerarPopupVisualizacao daqui, pois a lógica foi integrada diretamente no map.on('click')
    // para usar as variáveis 'content' e 'overlay' que são globais e dependem do HTML.
    // Se você ainda precisar de uma função genérica para SweetAlert2 em outros lugares,
    // pode adaptá-la, mas para o popup do mapa, a abordagem direta é mais eficaz.

    /* ==================== Medição de Distância e Área ==================== */
    mapFunctions.addInteraction = function(type) {
        mapFunctions.clearMeasurements();

        measureSource = new ol.source.Vector();
        measureLayer = new ol.layer.Vector({
            source: measureSource,
            style: new ol.style.Style({
                fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.2)' }),
                stroke: new ol.style.Stroke({ color: '#ffcc33', width: 3 }),
                image: new ol.style.Circle({
                    radius: 7,
                    fill: new ol.style.Fill({ color: '#ffcc33' })
                })
            })
        });
        map.addLayer(measureLayer);

        measureDraw = new ol.interaction.Draw({
            source: measureSource,
            type: type,
            style: new ol.style.Style({
                fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.2)' }),
                stroke: new ol.style.Stroke({ color: 'rgba(0, 0, 0, 0.5)', lineDash: [10, 10], width: 2 }),
                image: new ol.style.Circle({
                    radius: 5,
                    stroke: new ol.style.Stroke({ color: 'rgba(0, 0, 0, 0.7)' }),
                    fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.2)' })
                })
            })
        });
        map.addInteraction(measureDraw);

        map.on('pointermove', mapFunctions.pointerMoveHandler);

        if (!helpTooltipElement) {
            helpTooltipElement = document.createElement('div');
            helpTooltipElement.className = 'ol-tooltip ol-tooltip-help';
            helpTooltip = new ol.Overlay({
                element: helpTooltipElement,
                offset: [15, 0],
                positioning: 'center-left'
            });
            map.addOverlay(helpTooltip);
        }
        helpTooltipElement.style.display = 'block';

        measureDraw.on('drawstart', function(evt) {
            let sketch = evt.feature;
            sketch.getGeometry().on('change', function(evt) {
                let geom = evt.target;
                let output;
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

            if (!measureTooltipElement) {
                measureTooltipElement = document.createElement('div');
                measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';
                measureTooltip = new ol.Overlay({
                    element: measureTooltipElement,
                    offset: [0, -15],
                    positioning: 'bottom-center',
                    stopEvent: false,
                    insertFirst: true
                });
                map.addOverlay(measureTooltip);
            }
            measureTooltipElement.style.display = 'block';
            measureTooltip.setPosition(evt.coordinate);
        });

        measureDraw.on('drawend', function() {
            measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
            measureTooltip.setOffset([0, -7]);
            measureTooltipElement = null; // Reset for next measurement
            helpTooltipElement.style.display = 'none';
            map.un('pointermove', mapFunctions.pointerMoveHandler);
            map.removeInteraction(measureDraw);
            measureDraw = null;
        });
    };

    mapFunctions.pointerMoveHandler = function(evt) {
        if (evt.dragging) return;
        let helpMsg = 'Clique para começar a desenhar';
        if (measureDraw) {
            helpMsg = (measureDraw.get('type') === 'Polygon') ? continuePolygon : continueLine;
        }
        if (helpTooltipElement) {
            helpTooltipElement.innerHTML = helpMsg || 'Clique para começar a desenhar';
            helpTooltip.setPosition(evt.coordinate);
        }
    };

    mapFunctions.formatLength = (line) => {
        const length = ol.sphere.getLength(line, { projection: 'EPSG:3857' });
        return length > 100 ? `${(length / 1000).toFixed(2)} km` : `${length.toFixed(2)} m`;
    };

    mapFunctions.formatArea = (polygon) => {
        const area = ol.sphere.getArea(polygon, { projection: 'EPSG:3857' });
        return area > 10000 ? `${(area / 1000000).toFixed(2)} km²` : `${area.toFixed(2)} m²`;
    };

    mapFunctions.toggleMeasureDistance = () => measureDraw && measureDraw.get('type') === 'LineString' ? mapFunctions.clearMeasurements() : mapFunctions.addInteraction('LineString');
    mapFunctions.toggleMeasureArea = () => measureDraw && measureDraw.get('type') === 'Polygon' ? mapFunctions.clearMeasurements() : mapFunctions.addInteraction('Polygon');

    mapFunctions.clearMeasurements = function() {
        if (measureDraw) {
            map.removeInteraction(measureDraw);
            measureDraw = null;
        }
        if (measureLayer) {
            map.removeLayer(measureLayer);
            measureLayer = null;
            measureSource = null;
        }
        if (helpTooltipElement) helpTooltipElement.style.display = 'none';
        if (measureTooltipElement) {
            // Verifica se o parentNode existe antes de tentar remover
            if (measureTooltipElement.parentElement) {
                 document.body.removeChild(measureTooltipElement.parentElement); // Clean up static tooltips
            }
            measureTooltipElement = null;
        }
        map.un('pointermove', mapFunctions.pointerMoveHandler);
    };

    /* ==================== Funcionalidades de Impressão ==================== */
    mapFunctions.activatePrintMode = function() {
        document.body.classList.add('print-mode-active');
        printModeControls.style.display = 'flex';
        northArrowPrint.style.display = 'block';
        toolsPanel.classList.add('hidden-for-print');
        layerControlPanel.classList.add('hidden-for-print');
        searchPanel.classList.add('hidden-for-print');
        olControlsToHide.forEach(ctrl => ctrl && ctrl.classList.add('hidden-for-print'));
        scaleLineControl.element.classList.add('visible-for-print');
    };

    mapFunctions.deactivatePrintMode = function() {
        document.body.classList.remove('print-mode-active');
        printModeControls.style.display = 'none';
        northArrowPrint.style.display = 'none';
        toolsPanel.classList.remove('hidden-for-print');
        layerControlPanel.classList.remove('hidden-for-print');
        searchPanel.classList.remove('hidden-for-print');
        olControlsToHide.forEach(ctrl => ctrl && ctrl.classList.remove('hidden-for-print'));
        scaleLineControl.element.classList.remove('visible-for-print');
    };

    mapFunctions.triggerPrint = () => window.print();

    /* ==================== Funcionalidades de Exportação (KML) ==================== */
    mapFunctions.mostrarOpcoesExportacao = async function() {
        const { value: camadaKey } = await Swal.fire({
            title: 'Exportar Camada para KML',
            input: 'select',
            inputOptions: Object.keys(camadas).reduce((acc, key) => ({ ...acc, [key]: camadas[key].nome }), {}),
            inputPlaceholder: 'Selecione a camada',
            showCancelButton: true,
            inputValidator: (value) => !value && 'Você precisa selecionar uma camada!'
        });
        if (camadaKey) mapFunctions.exportLayerToKML(camadaKey);
    };

    mapFunctions.exportLayerToKML = function(camadaKey) {
        const layer = camadas[camadaKey].layer;
        if (!layer || !layer.getSource().getFeatures().length) {
            Swal.fire('Erro', `A camada "${camadas[camadaKey].nome}" não possui feições.`, 'error');
            return;
        }
        const format = new ol.format.KML();
        const kmlString = format.writeFeatures(layer.getSource().getFeatures(), {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        });
        const blob = new Blob([kmlString], { type: 'application/vnd.google-earth.kml+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${camadas[camadaKey].nome.replace(/\s+/g, '_')}.kml`;
        a.click();
        URL.revokeObjectURL(url);
        Swal.fire('Sucesso!', `Camada "${camadas[camadaKey].nome}" exportada.`, 'success');
    };

    /* ==================== Funcionalidade de Busca de Feições ==================== */
    const camadaSelect = document.getElementById('camadaSelect');
    const campoSelect = document.getElementById('campoSelect');
    const valorBuscaInput = document.getElementById('valorBusca');
    const sugestoesDiv = document.getElementById('sugestoes');

    let originalFeatureStyle = null;

    Object.keys(camadas).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = camadas[key].nome;
        camadaSelect.appendChild(option);
    });

    camadaSelect.addEventListener('change', () => {
        mapFunctions.populateCampoSelect(camadaSelect.value);
        valorBuscaInput.value = '';
        sugestoesDiv.innerHTML = '';
        sugestoesDiv.style.display = 'none';
    });

    mapFunctions.populateCampoSelect = function(camadaKey) {
        campoSelect.innerHTML = '<option value="">Selecione um campo...</option>';
        const camadaData = camadas[camadaKey];
        if (camadaData && camadaData.source) {
            const firstFeature = camadaData.source.getFeatures()[0];
            if (firstFeature) {
                const properties = firstFeature.getProperties();
                for (const key in properties) {
                    if (key !== 'geometry' && key !== 'id' && key !== 'bbox' && key !== 'style') {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = key;
                        campoSelect.appendChild(option);
                    }
                }
            }
        }
    };

    mapFunctions.populateCampoSelect(camadaSelect.value);

    valorBuscaInput.addEventListener('input', () => {
        const query = valorBuscaInput.value.toLowerCase();
        const camadaKey = camadaSelect.value;
        const campoKey = campoSelect.value;
        sugestoesDiv.innerHTML = '';
        sugestoesDiv.style.display = 'none';

        if (query.length < 2 || !camadaKey || !campoKey) return;

        const camadaData = camadas[camadaKey];
        if (camadaData && camadaData.source) {
            const suggestions = new Set();
            camadaData.source.getFeatures().forEach(feature => {
                const value = feature.get(campoKey);
                if (value && String(value).toLowerCase().includes(query)) {
                    suggestions.add(String(value));
                }
            });
            if (suggestions.size > 0) {
                suggestions.forEach(sugestao => {
                    const item = document.createElement('div');
                    item.className = 'sugestao-item';
                    item.textContent = sugestao;
                    item.onclick = () => {
                        valorBuscaInput.value = sugestao;
                        sugestoesDiv.style.display = 'none';
                        mapFunctions.buscarFeicao();
                    };
                    sugestoesDiv.appendChild(item);
                });
                sugestoesDiv.style.display = 'block';
            }
        }
    });

    document.addEventListener('click', (event) => {
        if (!sugestoesDiv.contains(event.target) && event.target !== valorBuscaInput) {
            sugestoesDiv.style.display = 'none';
        }
    });

    mapFunctions.buscarFeicao = async function() {
        mapFunctions.clearSearchHighlight();
        const camadaKey = camadaSelect.value;
        const campoKey = campoSelect.value;
        const valorBusca = valorBuscaInput.value;

        if (!camadaKey || !campoKey || !valorBusca) {
            Swal.fire('Aviso', 'Por favor, selecione camada, campo e valor.', 'warning');
            return;
        }

        const camadaData = camadas[camadaKey];
        const foundFeature = camadaData?.source?.getFeatures().find(f => String(f.get(campoKey)).toLowerCase() === String(valorBusca).toLowerCase());

        if (foundFeature) {
            currentSearchHighlightFeature = foundFeature;
            originalFeatureStyle = foundFeature.getStyle();
            const highlightStyle = new ol.style.Style({
                stroke: new ol.style.Stroke({ color: '#FFFF00', width: 5 }),
                fill: new ol.style.Fill({ color: 'rgba(255, 255, 0, 0.4)' }),
                image: new ol.style.Circle({
                    radius: 10,
                    fill: new ol.style.Fill({ color: '#FFFF00' }),
                    stroke: new ol.style.Stroke({ color: '#FFFFFF', width: 2 })
                })
            });
            foundFeature.setStyle(highlightStyle);
            map.getView().fit(foundFeature.getGeometry().getExtent(), {
                padding: [100, 100, 100, 100],
                duration: 1000
            });
            Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true })
                .fire({ icon: 'success', title: `Feição encontrada!` });
        } else {
            Swal.fire('Não Encontrado', 'Nenhuma feição corresponde à busca.', 'info');
        }
    };

    mapFunctions.clearSearchHighlight = function() {
        if (currentSearchHighlightFeature) {
            currentSearchHighlightFeature.setStyle(originalFeatureStyle);
            currentSearchHighlightFeature = null;
            originalFeatureStyle = null;
        }
    };

    function getRandomColor() { return '#' + Math.floor(Math.random() * 16777215).toString(16); }

} // Fim da função initializeMapAndLayers
