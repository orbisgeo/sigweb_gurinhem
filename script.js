// ======================== CONFIGURAÇÃO INICIAL ========================
const firebaseConfig = {
  apiKey: "AIzaSyDxxxxxxx",
  authDomain: "ruas-gurinhem.firebaseapp.com",
  projectId: "ruas-gurinhem"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const map = L.map("map", {
  center: [-7.12, -35.42],
  zoom: 15,
  zoomControl: true,
  attributionControl: false
});

const maptilerKey = "Ji8wXSrUbB9cb5w3dSsc";
const satelite = L.tileLayer(`https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${maptilerKey}`, {
  tileSize: 512,
  zoomOffset: -1
});
satelite.addTo(map);

const baseMaps = { "🛰️ Satélite MapTiler": satelite };
const overlays = {};
const layerControl = L.control.layers(baseMaps, overlays, { collapsed: false }).addTo(map);

// ======================== CAMADAS DEFINIDAS ========================
const camadas = {
  ruas_nomeadas: { nome: "Ruas", cor: "#FF0000", grupo: L.layerGroup() },
  ZONA_URBANA: { nome: "Zona Urbana", cor: "#33a02c", grupo: L.layerGroup() },
  corpos_hidricos_gr: { nome: "Corpos Hídricos", cor: "#1c91c0", grupo: L.layerGroup() },
  BAIRROS_GR: { nome: "Bairros", cor: null, grupo: L.layerGroup() },
  rodovia: { nome: "Rodovias", cor: "#e6550d", grupo: L.layerGroup() },
  QUADRAS_GR: { nome: "Quadras", cor: "#8c564b", grupo: L.layerGroup() },
  zona_de_expansao: { nome: "Zona de Expansão", cor: "#d4b000", grupo: L.layerGroup() },
  predios_publicos: { nome: "Prédios Públicos", tipo: "ponto", cor: "#0066CC", grupo: L.layerGroup() }
};

const ativadasPorPadrao = ["ruas_nomeadas", "QUADRAS_GR"];
let carregadas = 0;
const tooltipsQuadras = [];
const tooltipsPredios = [];
const cacheCampos = {};
let ultimaBuscaLayer = null;

const camadaSelect = document.getElementById("camadaSelect");
const campoSelect = document.getElementById("campoSelect");
const inputBusca = document.getElementById("valorBusca");
const sugestoes = document.getElementById("sugestoes");

for (const nome in camadas) {
  camadaSelect.innerHTML += `<option value="${nome}">${camadas[nome].nome}</option>`;
}

camadaSelect.addEventListener("change", async () => {
  const camada = camadaSelect.value;
  campoSelect.innerHTML = "<option>Carregando...</option>";
  if (cacheCampos[camada]) {
    preencherCampoSelect(cacheCampos[camada]);
    return;
  }
  const snapshot = await db.collection("GeoData").doc(camada).collection("features").limit(1).get();
  const doc = snapshot.docs[0]?.data();
  campoSelect.innerHTML = "";
  if (doc) {
    const campos = Object.keys(doc.properties);
    cacheCampos[camada] = campos;
    preencherCampoSelect(campos);
  }
});

function preencherCampoSelect(campos) {
  campoSelect.innerHTML = "";
  campos.forEach(k => {
    campoSelect.innerHTML += `<option value="${k}">${k}</option>`;
  });
}

inputBusca.addEventListener("input", async () => {
  const camada = camadaSelect.value;
  const campo = campoSelect.value;
  const valor = inputBusca.value.trim();
  if (!valor || !campo || !camada) {
    sugestoes.innerHTML = "";
    sugestoes.style.display = "none";
    return;
  }

  sugestoes.innerHTML = "";
  const ref = db.collection("GeoData").doc(camada).collection("features");
  const snapshot = await ref.get();
  const valoresUnicos = new Set();

  snapshot.forEach(doc => {
    const dado = doc.data().properties[campo];
    if (dado && String(dado).toLowerCase().includes(valor.toLowerCase())) {
      valoresUnicos.add(dado);
    }
  });

  if (valoresUnicos.size > 0) {
    valoresUnicos.forEach(v => {
      const div = document.createElement("div");
      div.textContent = v;
      div.className = "sugestao-item";
      div.onclick = () => {
        inputBusca.value = v;
        sugestoes.style.display = "none";
        buscarFeicao();
      };
      sugestoes.appendChild(div);
    });
    sugestoes.style.display = "block";
  } else {
    sugestoes.style.display = "none";
  }
});

document.addEventListener("click", (e) => {
  if (!sugestoes.contains(e.target) && e.target !== inputBusca) {
    sugestoes.style.display = "none";
  }
});

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  return '#' + Array.from({ length: 6 }, () => letters[Math.floor(Math.random() * 16)]).join('');
}

async function carregarCamada(nome) {
  const camada = camadas[nome];
  const ref = db.collection("GeoData").doc(nome).collection("features");
  const snapshot = await ref.get();

  snapshot.forEach(doc => {
    const dados = doc.data();
    let geojson;
    try {
      geojson = JSON.parse(dados.geometry);
    } catch (e) {
      console.error(`Erro ao fazer parse da geometria (${nome}):`, e, dados.geometry);
      return;
    }

    const cor = nome === "BAIRROS_GR" ? getRandomColor() : camada.cor;
    const props = dados.properties;

    if (camada.tipo === "ponto" && geojson.type === "Point") {
      const [lng, lat] = geojson.coordinates;
      const marker = L.circleMarker([lat, lng], {
        radius: 6,
        color: cor,
        fillOpacity: 0.9
      }).addTo(camada.grupo);

      marker.bindPopup(gerarPopup(props));
      marker.on("mouseover", function () { this.setStyle({ radius: 8, color: "#ffaa00" }); });
      marker.on("mouseout", function () { this.setStyle({ radius: 6, color: cor }); });

      if (props.nome) {
        const tooltip = marker.bindTooltip(String(props.nome), {
          permanent: true, direction: 'top', className: 'label-predio', opacity: 1
        }).getTooltip();
        tooltipsPredios.push(tooltip);
        tooltip._source.closeTooltip();
      }
    } else {
      const feature = L.geoJSON(geojson, {
        style: { color: cor, weight: 2 },
        onEachFeature: (feature, layer) => {
          layer.bindPopup(gerarPopup(props));
          layer.on("mouseover", () => layer.setStyle({ weight: 4, color: "#ffaa00" }));
          layer.on("mouseout", () => layer.setStyle({ weight: 2, color: cor }));
          if (nome === "QUADRAS_GR" && props.id_quadra) {
            const tooltip = layer.bindTooltip(String(props.id_quadra), {
              permanent: true, direction: "center", className: "label-quadra", opacity: 1
            }).getTooltip();
            tooltipsQuadras.push(tooltip);
            tooltip._source.closeTooltip();
          }
        }
      }).addTo(camada.grupo);
      feature.properties = props;
    }
  });

  if (ativadasPorPadrao.includes(nome)) {
    camada.grupo.addTo(map);
  }

  overlays[camada.nome] = camada.grupo;
  layerControl.addOverlay(camada.grupo, camada.nome);
  carregadas++;
  if (carregadas === Object.keys(camadas).length) {
    camadaSelect.dispatchEvent(new Event("change"));
  }
}

function gerarPopup(properties) {
  return Object.entries(properties).map(([k, v]) => `<strong>${k}</strong>: ${v}<br>`).join("");
}

for (const nome in camadas) carregarCamada(nome);

map.on("zoomend", () => {
  const zoom = map.getZoom();
  const mostrar = zoom >= 17;
  tooltipsQuadras.forEach(t => t._source && (mostrar ? t._source.openTooltip() : t._source.closeTooltip()));
  tooltipsPredios.forEach(t => t._source && (mostrar ? t._source.openTooltip() : t._source.closeTooltip()));
});

// ======================== FUNÇÃO DE BUSCA CORRIGIDA ========================
async function buscarFeicao() {
  const camada = camadaSelect.value;
  const campo = campoSelect.value;
  const valor = inputBusca.value.trim();
  if (!valor || !campo || !camada) return;

  sugestoes.innerHTML = "";
  sugestoes.style.display = "none";

  if (ultimaBuscaLayer) {
    map.removeLayer(ultimaBuscaLayer);
    ultimaBuscaLayer = null;
  }

  const ref = db.collection("GeoData").doc(camada).collection("features");
  const snapshot = await ref.get();
  const encontrados = [];

  snapshot.forEach(doc => {
    const dados = doc.data();
    const dadoCampo = dados.properties?.[campo];
    if (dadoCampo && String(dadoCampo).trim().toLowerCase() === valor.toLowerCase()) {
      try {
        const geometry = JSON.parse(dados.geometry);
        encontrados.push({ geometry, properties: dados.properties });
      } catch (e) {
        console.error("Erro ao fazer parse da geometria:", e);
      }
    }
  });

  if (encontrados.length > 0) {
    const featureGroup = L.featureGroup();
    encontrados.forEach(item => {
      let featureLayer;
      if (item.geometry.type === "Point") {
        const [lng, lat] = item.geometry.coordinates;
        featureLayer = L.circleMarker([lat, lng], {
          radius: 8, color: "#FFD700", fillColor: "#FFD700", fillOpacity: 0.9, weight: 2
        });
      } else {
        featureLayer = L.geoJSON(item.geometry, {
          style: { color: "#FFD700", weight: 5, dashArray: "4, 3" }
        });
      }
      featureLayer.bindPopup(gerarPopup(item.properties));
      featureLayer.on("click", function () { this.openPopup(); });
      featureLayer.addTo(featureGroup);
    });

    featureGroup.addTo(map);
    ultimaBuscaLayer = featureGroup;

    const bounds = featureGroup.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    } else if (encontrados.length === 1 && encontrados[0].geometry.type === "Point") {
      const [lng, lat] = encontrados[0].geometry.coordinates;
      map.setView([lat, lng], 18);
    } else {
      alert("Feição encontrada, mas não foi possível centralizar o mapa.");
    }
  } else {
    alert("Nenhuma feição encontrada.");
  }
}
