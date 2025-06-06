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
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
const satelite = L.tileLayer(`https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${maptilerKey}`, {
  tileSize: 512,
  zoomOffset: -1
});

osm.addTo(map);

const baseMaps = {
  "🗺️ OpenStreetMap": osm,
  "🛰️ Satélite MapTiler": satelite
};

const overlays = {};

const camadas = {
  "ruas_nomeadas": { nome: "Ruas", cor: "#FF0000", grupo: L.layerGroup() },
  "ZONA_URBANA": { nome: "Zona Urbana", cor: "#33a02c", grupo: L.layerGroup() },
  "corpos_hidricos_gr": { nome: "Corpos Hídricos", cor: "#1c91c0", grupo: L.layerGroup() },
  "BAIRROS_GR": { nome: "Bairros", cor: null, grupo: L.layerGroup() },
  "rodovia": { nome: "Rodovias", cor: "#e6550d", grupo: L.layerGroup() },
  "QUADRAS_GR": { nome: "Quadras", cor: "#8c564b", grupo: L.layerGroup() },
  "zona_de_expansao": { nome: "Zona de Expansão", cor: "#d4b000", grupo: L.layerGroup() }
};

const ativadasPorPadrao = ["ruas_nomeadas", "QUADRAS_GR", "BAIRROS_GR"];
let carregadas = 0;

const camadaSelect = document.getElementById("camadaSelect");
const campoSelect = document.getElementById("campoSelect");
const inputBusca = document.getElementById("valorBusca");
const sugestoes = document.getElementById("sugestoes");
let ultimaBuscaLayer = null;

for (const nome in camadas) {
  camadaSelect.innerHTML += `<option value="${nome}">${camadas[nome].nome}</option>`;
}

camadaSelect.addEventListener("change", async () => {
  const camada = camadaSelect.value;
  campoSelect.innerHTML = "<option>Carregando...</option>";
  const snapshot = await db.collection("GeoData").doc(camada).collection("features").limit(1).get();
  const doc = snapshot.docs[0]?.data();
  campoSelect.innerHTML = "";
  if (doc) {
    Object.keys(doc.properties).forEach(k => {
      campoSelect.innerHTML += `<option value="${k}">${k}</option>`;
    });
  }
});

inputBusca.addEventListener("input", async () => {
  const camada = camadaSelect.value;
  const campo = campoSelect.value;
  const valor = inputBusca.value.trim().toLowerCase();
  if (!valor || !campo || !camada) return;
  const ref = db.collection("GeoData").doc(camada).collection("features");
  const snapshot = await ref.get();
  const valoresUnicos = new Set();
  snapshot.forEach(doc => {
    const dado = doc.data().properties[campo];
    if (dado && String(dado).toLowerCase().includes(valor)) {
      valoresUnicos.add(dado);
    }
  });
  sugestoes.innerHTML = "";
  if (valoresUnicos.size > 0) {
    valoresUnicos.forEach(v => {
      const div = document.createElement("div");
      div.textContent = v;
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
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

async function carregarCamada(nome) {
  const camada = camadas[nome];
  const ref = db.collection("GeoData").doc(nome).collection("features");
  const snapshot = await ref.get();
  snapshot.forEach(doc => {
    const dados = doc.data();
    const geojson = JSON.parse(dados.geometry);
    const cor = nome === "BAIRROS_GR" ? getRandomColor() : camada.cor;
    const feature = L.geoJSON(geojson, {
      style: { color: cor, weight: 2 },
      onEachFeature: function (feature, layer) {
        let popup = "";
        for (const [k, v] of Object.entries(dados.properties)) {
          popup += `<strong>${k}</strong>: ${v}<br>`;
        }
        layer.bindPopup(popup);
        layer.on("mouseover", function () {
          this.setStyle({ weight: 4, color: "#ffaa00" });
          this.openPopup();
        });
        layer.on("mouseout", function () {
          this.setStyle({ weight: 2, color: cor });
          this.closePopup();
        });
      }
    }).addTo(camada.grupo);
    feature.properties = dados.properties;
  });

  if (ativadasPorPadrao.includes(nome)) {
    camada.grupo.addTo(map);
  }

  overlays[camadas[nome].nome] = camada.grupo;
  carregadas++;
  if (carregadas === Object.keys(camadas).length) {
    L.control.layers(baseMaps, overlays, { collapsed: false }).addTo(map);
    camadaSelect.dispatchEvent(new Event("change"));
  }
}

for (const nome in camadas) carregarCamada(nome);

async function buscarFeicao() {
  const camada = camadaSelect.value;
  const campo = campoSelect.value;
  const valor = inputBusca.value.trim().toLowerCase();
  if (!valor) return;
  if (ultimaBuscaLayer) map.removeLayer(ultimaBuscaLayer);
  const ref = db.collection("GeoData").doc(camada).collection("features");
  const snapshot = await ref.get();
  const encontrados = [];
  snapshot.forEach(doc => {
    const dados = doc.data();
    if (String(dados.properties[campo] || "").toLowerCase() === valor) {
      encontrados.push({ geometry: JSON.parse(dados.geometry), properties: dados.properties });
    }
  });
  if (encontrados.length > 0) {
    const layerGroup = L.layerGroup();
    encontrados.forEach(item => {
      const feature = L.geoJSON(item.geometry, {
        style: { color: "#FFD700", weight: 5, dashArray: "4, 3" },
        onEachFeature: function (feature, layer) {
          let popup = "";
          for (const [k, v] of Object.entries(item.properties)) {
            popup += `<strong>${k}</strong>: ${v}<br>`;
          }
          layer.bindPopup(popup);
          layer.on("add", function () {
            layer.openPopup();
          });
        }
      });
      feature.addTo(layerGroup);
    });
    layerGroup.addTo(map);
    map.fitBounds(layerGroup.getBounds());
    map.setZoom(18);
    ultimaBuscaLayer = layerGroup;
  } else {
    alert("Nenhuma feição encontrada.");
  }
}
