async function main() {
    const response = await fetch('data/models.json');
    const text = await response.text();
    const objs = JSON.parse(text);

    const models = [];
    let objsOnScene = [];
    let lights = [{
        lightDirectionX: -1,
        lightDirectionY: 3,
        lightDirectionZ: 5,
        colorLight: [255, 255, 255],
        lightIntensity: 1.0,
    }]
    let toonShader = false;

    const canvasM = document.querySelector("#canvasModels");
    const glModels = canvasM.getContext("webgl2");
    if (!glModels) {
        return;
    }
    twgl.setAttributePrefix("a_");
    const meshProgramInfoModels = twgl.createProgramInfo(glModels, [vertexShaderM, fragmentShaderM]);

    objs.forEach((obj, index) => {
        models.push(new Model(obj, index, glModels, meshProgramInfoModels));
    });

    document.getElementById("save").disabled = true;
    document.getElementById("load").disabled = false;

    for (let i = 0; i < models.length; i++) {
        models[i].insertModel(); // interface
        await models[i].load();
    }

    canvas = document.querySelector("#canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) {
        return;
    }
    twgl.setAttributePrefix("a_");
    const meshProgramInfo = twgl.createProgramInfo(gl, [vertexShader, fragmentShader]);

    const contentElem = document.getElementById('LTS');
    const t = createElem('div', contentElem, 'tLTS');
    t.style.fontSize = "15px";
    t.style.margin = "10px 0 5px 0";
    t.innerText = "Luzes:";
    let nLights = 0;
    addLight();

    models.forEach((obj, index) => {
        const model = document.getElementById('model' + String(index));
        model.addEventListener('click', () => {  // click models
            objsOnScene.push(new Obj(obj, objsOnScene.length, [1, 1, 1], [degToRad(0), degToRad(0), degToRad(0)],
                [0, 0, 0], " ", [255, 255, 255], [255, 255, 255], 400, 1,
                gl, meshProgramInfo, lights, toonShader));
        });
    });

    document.getElementById('save').addEventListener('click', () => {
        const sceneData = {
            toonShader: toonShader,
            lights: lights,
            objects: objsOnScene
        };
        const sceneJSON = JSON.stringify(sceneData);
        const blob = new Blob([sceneJSON], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'my_scene.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });

    document.getElementById('load').addEventListener('click', () => {
        document.getElementById('fileInput').click();
        document.getElementById('fileInput').addEventListener('change', function (event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async function (event) {
                    const conteudoJSON = event.target.result;
                    let sceneData = JSON.parse(conteudoJSON);
                    if (sceneData.toonShader) {
                        toonShader = sceneData.toonShader;
                    }
                    if (sceneData.lights) {
                        lights = sceneData.lights;
                    }
                    if (sceneData.objects) {
                        objsOnScene = sceneData.objects.map((obj, i) => {
                            return new Obj(obj, i, obj.scale, obj.rotation, obj.translation, obj.diffuseMap, obj.diffuse, obj.specular, obj.shininess, obj.opacity, gl, meshProgramInfo, lights, toonShader);
                        });
                    }
                };
                reader.readAsText(file);
            }
        });
    });

    const addL = document.getElementById("addLightB");
    addL.addEventListener('click', () => {
        lights[nLights] = {
            lightDirectionX: 0,
            lightDirectionY: 1,
            lightDirectionZ: 2,
            colorLight: [255, 255, 255],
            lightIntensity: 1.0,
        }
        addLight();
    });

    function addLight(){
        nLights += 1;
        if (nLights==5){document.getElementById("addLightB").disabled = true;}
        const list = createElem('div', contentElem, 'lightsList');
        list.id = "lightsList" + String(nLights-1);
        list.style.fontSize = "16px";
        list.style.padding = "2px";
        list.innerText = String(nLights) + ". " + "Luz";
        list.addEventListener("mouseover", function (event) {
            event.target.style.cursor = "pointer";
            event.target.style.color = "white";
        });
        list.addEventListener("mouseout", function (event) {
            event.target.style.cursor = "auto";
            event.target.style.color = "black";
        });

        list.addEventListener('click', () => {
            for (let i = 0; i < 5; i++) {
                let l = document.getElementById("lightsList" + i);
                if (l) { l.style.backgroundColor = "#C5D7D9"; }
            }

            list.style.backgroundColor = "#2AB0BF";

            let id = list.id.split("st");
            id = id[1];

            const test = document.getElementById("lightB");
            const a = buttonsLight(id);
            if (test) {
                test.innerHTML = a;
            } else {
                const lb = document.getElementById("lightButtons");
                const div = document.createElement("div");
                div.innerHTML = a;
                lb.appendChild(div);
                div.id = "lightB";
            }
     
            const ld = document.getElementById("lightDirectionX" + String(id));
            ld.addEventListener("input", () => {
                lights[id].lightDirectionX = parseFloat(ld.value);
            });

            const ldy = document.getElementById("lightDirectionY" + String(id));
            ldy.addEventListener("input", () => {
                lights[id].lightDirectionY = parseFloat(ldy.value);
            });

            const ldz = document.getElementById("lightDirectionZ" + String(id));
            ldz.addEventListener("input", () => {
                lights[id].lightDirectionZ = parseFloat(ldz.value);
            });           

            let r = ['R', 'G', 'B'];
            for (let i = 0; i < 3; i++) {
                const colorL = document.getElementById("lc" + r[i] + String(id));
                colorL.addEventListener("input", () => {
                    lights[id].colorLight[i] = colorL.value; 
                });
            }

            const iL = document.getElementById("lint" + String(id));
            iL.addEventListener("input", () => {
                lights[id].lightIntensity = iL.value; 
            });                 
        });
    }
    
    // Toon Shader
    const ts = document.getElementById("toonShaderB");
    ts.addEventListener('click', () => {
        if(toonShader){
            toonShader = false;
            ts.style.backgroundColor = "#C5D7D9";
            ts.style.color = "black";
            ts.addEventListener("mouseover", function (event) {
                ts.style.backgroundColor = "#013440";
                ts.style.color = "white";
            });
            ts.addEventListener("mouseout", function (event) {
                ts.style.backgroundColor = "#C5D7D9";
                ts.style.color = "black";
            });
        }else{            
            toonShader = true;
            ts.style.backgroundColor = "#013440";
            ts.style.color = "white";
            ts.addEventListener("mouseover", function (event) {
                ts.style.backgroundColor = "#C5D7D9";
                ts.style.color = "black";
            });
            ts.addEventListener("mouseout", function (event) {
                ts.style.backgroundColor = "#013440";
                ts.style.color = "white";
            });
        }
        objsOnScene.forEach(obj => {
            obj.toonShader = toonShader;
        });
    });

    function buttonsLight(id) {
        return `
            <div class="ti">Direção da Luz X: </div>
            <input type="range" min="-20" max="20" id="lightDirectionX${String(id)}" value="${lights[id].lightDirectionX.toFixed(3)}">
            <div class="ti">Direção da Luz Y: </div>
            <input type="range" min="-20" max="20" id="lightDirectionY${String(id)}" value="${lights[id].lightDirectionY.toFixed(3)}">
            <div class="ti">Direção da Luz Z: </div>
            <input type="range" min="-20" max="20" id="lightDirectionZ${String(id)}" value="${lights[id].lightDirectionZ.toFixed(3)}">
            
            <div class="ti">Cor da Luz R: </div>
            <input type="range" min="0" max="255" id="lcR${String(id)}" value="${lights[id].colorLight[0]}">
            <div class="ti">Cor da Luz G: </div>
            <input type="range" min="0" max="255" id="lcG${String(id)}" value="${lights[id].colorLight[1]}">
            <div class="ti">Cor da Luz B: </div>
            <input type="range" min="0" max="255" id="lcB${String(id)}" value="${lights[id].colorLight[2]}">

            <div class="ti">Intensidade da Luz</div>
            <input type="range" min="0.1" max="1.5" step="0.1" id="lint${String(id)}" value="${lights[id].lightIntensity}">
        `;
    }
}

main();

