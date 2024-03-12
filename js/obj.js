class Obj extends Model {
    constructor(obj, index, scale, rotation, translation, diffuseMap, diffuse, specular,
        shininess, opacity, gl, meshProgramInfo, lights, toonShader) {
        super(obj, index, gl, meshProgramInfo);
        this.scale = scale;
        this.rotation = rotation;
        this.translation = translation;
        this.diffuseMap = diffuseMap;
        this.diffuse = diffuse;
        this.specular = specular;
        this.shininess = shininess;
        this.opacity = opacity;
        this.textures;
        this.lights = lights;
        this.toonShader = toonShader;

        this.render = this.render.bind(this);

        this.insertObj();   // interface
        this.putOnScene();
        
    }

    async putOnScene() {
        const response = await fetch(this.href);
        const text = await response.text();
        this.obj = parseOBJ(text);

        const baseHref = new URL(this.href, window.location.href);
        const matTexts = await Promise.all(
            this.obj.materialLibs.map(async (filename) => {
                const matHref = new URL(filename, baseHref).href;
                const response = await fetch(matHref);
                return await response.text();
            })
        );
        this.materials = parseMTL(matTexts.join("\n"));

        this.textures = {
            defaultWhite: twgl.createTexture(this.gl, { src: [255, 255, 255, 255] }),
        };

        for (const material of Object.values(this.materials)) {
            Object.entries(material)
                .filter(([key]) => key.endsWith("Map"))
                .forEach(([key, filename]) => {
                    let texture = this.textures[filename];
                    if (!texture) {
                        const textureHref = new URL(filename, baseHref).href;
                        texture = twgl.createTexture(this.gl, { src: textureHref, flipY: true });
                        this.textures[filename] = texture;
                    }
                    material[key] = texture;
                });
        }

        const defaultMaterial = {
            diffuse: [1, 1, 1],
            diffuseMap: this.textures.defaultWhite,
            ambient: [0, 0, 0],
            specular: [1, 1, 1],
            specularMap: this.textures.defaultWhite,
            shininess: 400,
            opacity: 1,
        };

        this.parts = this.obj.geometries.map(({ material, data }) => {
            if (data.color) {
                if (data.position.length === data.color.length) {
                    data.color = { numComponents: 3, data: data.color };
                }
            } else {
                data.color = { value: [1, 1, 1, 1] };
            }

            const bufferInfo = twgl.createBufferInfoFromArrays(this.gl, data);
            const vao = twgl.createVAOFromBufferInfo(this.gl, this.meshProgramInfo, bufferInfo);
            return {
                material: {
                    ...defaultMaterial,
                    ...this.materials[material],
                },
                bufferInfo,
                vao,
            };
        });

        const extents = getGeometriesExtents(this.obj.geometries);
        const range = m4.subtractVectors(extents.max, extents.min);
        if (this.translation[0] == 0 && this.translation[1] == 0 && this.translation[2] == 0) {
            this.translation = m4.scaleVector(
                m4.addVectors(
                    extents.min,
                    m4.scaleVector(range, 0.5)),
                -1);
        }

        this.cameraTarget = [0, 0, 0];
        const radius = m4.length(range) * 1.0;
        this.cameraPosition = [0, 0, 10];

        this.zNear = radius / 150;
        this.zFar = radius * 15;

        requestAnimationFrame(this.render);
    }

    render() {
        twgl.resizeCanvasToDisplaySize(this.gl.canvas);
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);

        const fieldOfViewRadians = degToRad(60);
        const aspect = this.gl.canvas.clientWidth / this.gl.canvas.clientHeight;
        const projection = m4.perspective(fieldOfViewRadians, aspect, this.zNear, this.zFar);

        const up = [0, 1, 0];
        let camera = m4.lookAt(this.cameraPosition, this.cameraTarget, up);
        const view = m4.inverse(camera);

        let positions = [];
        let colors = [];
        let intensities = [];
        for (let i = 0; i < this.lights.length; i++) {
            positions.push(this.lights[i].lightDirectionX, this.lights[i].lightDirectionY, this.lights[i].lightDirectionZ);
            colors.push(this.lights[i].colorLight[0], this.lights[i].colorLight[1], this.lights[i].colorLight[2]);
            intensities.push(this.lights[i].lightIntensity);
        }

        const sharedUniforms = {
            u_view: view,
            u_projection: projection,
            u_viewWorldPosition: this.cameraPosition,
            u_ambientLight: [0.1, 0.1, 0.1],
            u_lightPosition: positions,
            u_colorLight: colors, 
            u_lights: this.lights.length,
            u_toonShader: this.toonShader ? 1 : 0, 
            u_lightIntensity: intensities,
        };

        this.gl.useProgram(this.meshProgramInfo.program);
        twgl.setUniforms(this.meshProgramInfo, sharedUniforms);

        let translationMatrix = m4.translation(this.translation[0], this.translation[1], this.translation[2]);
        let rotationMatrixX = m4.xRotation(this.rotation[0]);
        let rotationMatrixY = m4.yRotation(this.rotation[1]);
        let rotationMatrixZ = m4.zRotation(this.rotation[2]);
        let scaleMatrix = m4.scaling(...this.scale);

        let u_world = m4.identity();
        u_world = m4.multiply(u_world, translationMatrix);
        u_world = m4.multiply(u_world, rotationMatrixX);
        u_world = m4.multiply(u_world, rotationMatrixY);
        u_world = m4.multiply(u_world, rotationMatrixZ);
        u_world = m4.multiply(u_world, scaleMatrix);

        for (const { bufferInfo, vao, material } of this.parts) {
            if (this.diffuseMap == 'defaultWhite') {
                material.diffuseMap = this.textures['defaultWhite'];
            } else {
                material.diffuseMap = this.textures['halloweenbits_texture.png'];
            }

            let a = [];
            a.push(this.diffuse[0] / 255);
            a.push(this.diffuse[1] / 255);
            a.push(this.diffuse[2] / 255);
            material.diffuse = a;

            a = [];
            a.push(this.specular[0] / 255);
            a.push(this.specular[1] / 255);
            a.push(this.specular[2] / 255);
            material.specular = a;

            material.shininess = this.shininess;
            material.opacity = this.opacity;

            this.gl.bindVertexArray(vao);
            twgl.setUniforms(
                this.meshProgramInfo,
                {
                    u_world,
                },
                material
            );
            twgl.drawBufferInfo(this.gl, bufferInfo);
        }
        
        requestAnimationFrame(this.render);
    }

    insertObj() {
        const test1 = document.getElementById("objList0");
        if(!test1) {
            const contentElem = document.getElementById('list');
            const list = createElem('div', contentElem, 'objList');
            list.style.fontSize = "15px";
            list.style.margin = "10px 0 5px 0";
            list.innerText = "Objetos:";
        }

        const contentElem = document.getElementById('list');
        const list = createElem('div', contentElem, 'objList');
        list.id = "objList" + this.index;
        list.style.fontSize = "16px";
        list.style.padding = "2px";
        list.innerText = String(this.index + 1) + ". " + this.name;
        list.addEventListener("mouseover", function (event) {
            event.target.style.cursor = "pointer";
            event.target.style.color = "white";
        });
        list.addEventListener("mouseout", function (event) {
            event.target.style.cursor = "auto";
            event.target.style.color = "black";
        });

        document.getElementById("save").disabled = false;
        document.getElementById("load").disabled = true;

        list.addEventListener('click', () => {
            for (let i = 0; i <= 99; i++) {
                let l = document.getElementById("objList" + i);
                if (l) { l.style.backgroundColor = "#C5D7D9"; }
            }

            list.style.backgroundColor = "#2AB0BF";

            const test = document.getElementById("tr");

            const a = this.buttons();
            
            if (test) {
                test.innerHTML = a;
            } else {
                const transf = document.getElementById("transf");
                const div = document.createElement("div");
                div.innerHTML = a;
                transf.appendChild(div);
                div.id = "tr";
            }

            // update transforms
            let x = ["x", "y", "z"];

            for (let i = 0; i < 3; i++) {
                const scale = document.getElementById("scale" + x[i] + String(this.index));
                scale.addEventListener("input", () => {
                    this.scale[i] = parseFloat(scale.value);
                    const span = document.getElementById("s" + x[i]);
                    span.innerHTML = ":&nbsp&nbsp" + scale.value;
                    span.style.fontSize = "16px";
                });
            }

            for (let i = 0; i < 3; i++) {
                const rot = document.getElementById("rot" + x[i] + String(this.index));
                rot.addEventListener("input", () => {
                    this.rotation[i] = degToRad(parseInt(rot.value));
                    const span = document.getElementById("r" + x[i]);
                    span.innerHTML = ":&nbsp&nbsp" + rot.value;
                    span.style.fontSize = "16px";
                });
            }

            for (let i = 0; i < 3; i++) {
                const t = document.getElementById("tr" + x[i] + String(this.index));
                t.addEventListener("input", () => {
                    this.translation[i] = parseFloat(t.value);
                    const span = document.getElementById("t" + x[i]);
                    span.innerHTML = ":&nbsp&nbsp" + t.value;
                    span.style.fontSize = "16px";
                });
            }

            const text = document.getElementById("button-text" + String(this.index));
            text.addEventListener("click", () => {
                this.diffuseMap = 'halloweenbits';
            });

            const white = document.getElementById("button-white" + String(this.index));
            white.addEventListener("click", () => {
                this.diffuseMap = 'defaultWhite';
            });

            let r = ['r', 'g', 'b'];
            for (let i = 0; i < 3; i++) {
                const dif = document.getElementById("dif" + r[i] + String(this.index));
                dif.addEventListener('input', () => {
                    this.diffuse[i] = dif.value;
                });
            }

            for (let i = 0; i < 3; i++) {
                const spec = document.getElementById("spec" + r[i] + String(this.index));
                spec.addEventListener('input', () => {
                    this.specular[i] = spec.value;
                });
            }

            const shi = document.getElementById("shi" + String(this.index));
            shi.addEventListener('input', () => {
                this.shininess = shi.value;
            });

            const op = document.getElementById("op" + String(this.index));
            op.addEventListener('input', () => {
                this.opacity = op.value;
            });
        });
    }

    buttons() {
        return `
            <div id="text"> 
                <button class="button-text" id="button-text${String(this.index)}"></button>
                <button class="button-white" id="button-white${String(this.index)}"></button>
            </div>
            
            <div class="ti">Rotação X<span id="rx">: ${this.rotation[0]}</span></div>
            <input type="range" min="0" max="360" id="rotx${String(this.index)}" value="${this.rotation[0]}">
            <div class="ti">Rotação Y<span id="ry">: ${this.rotation[1]}</span></div> 
            <input type="range" min="0" max="360" id="roty${String(this.index)}" value="${this.rotation[1]}">
            <div class="ti">Rotação Z<span id="rz">: ${this.rotation[2]}</span></div>  
            <input type="range" min="0" max="360" id="rotz${String(this.index)}" value="${this.rotation[2]}">
            
            <div class="ti">Escala X<span id="sx">: ${this.scale[0]}</span></div>  
            <input type="range" min="0" max="5" step="0.001" id="scalex${String(this.index)}" value="${this.scale[0]}">
            <div class="ti">Escala Y<span id="sy">: ${this.scale[1]}</span></div>  
            <input type="range" min="0" max="5" step="0.001" id="scaley${String(this.index)}" value="${this.scale[1]}">
            <div class="ti">Escala Z<span id="sz">: ${this.scale[2]}</span></div>  
            <input type="range" min="0" max="5" step="0.001" id="scalez${String(this.index)}" value="${this.scale[2]}">
            
            <div class="ti">Translação X<span id="tx">: ${this.translation[0].toFixed(2)}</span></div>
            <input type="range" min="-8" max="8" step="0.001" id="trx${String(this.index)}" value="${this.translation[0]}">
            <div class="ti">Translação Y<span id="ty">: ${this.translation[1].toFixed(2)}</span></div> 
            <input type="range" min="-8" max="8" step="0.001" id="try${String(this.index)}" value="${this.translation[1]}">
            <div class="ti">Translação Z<span id="tz">: ${this.translation[2].toFixed(2)}</span></div> 
            <input type="range" min="-8" max="8" step="0.001" id="trz${String(this.index)}" value="${this.translation[2]}">
        
            <div class="ti">Diffuse Color R</div>
            <input type="range" min="0" max="255" id="difr${String(this.index)}" value="${this.diffuse[0]}">
            <div class="ti">Diffuse Color G</div>
            <input type="range" min="0" max="255" id="difg${String(this.index)}" value="${this.diffuse[1]}">
            <div class="ti">Diffuse Color B</div>
            <input type="range" min="0" max="255" id="difb${String(this.index)}" value="${this.diffuse[2]}">

            <div class="ti">Specular Color R</div>
            <input type="range" min="0" max="255" id="specr${String(this.index)}" value="${this.specular[0]}">
            <div class="ti">Specular Color G</div>
            <input type="range" min="0" max="255" id="specg${String(this.index)}" value="${this.specular[1]}">
            <div class="ti">Specular Color B</div>
            <input type="range" min="0" max="255" id="specb${String(this.index)}" value="${this.specular[2]}">

            <div class="ti">Shininess</div>
            <input type="range" min="0" max="500" id="shi${String(this.index)}" value="${this.shininess}">

            <div class="ti">Opacity</div>
            <input type="range" min="0" max="1" step="0.01" id="op${String(this.index)}" value="${this.opacity}">
       
        `;
    }
}

