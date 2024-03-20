class Model {
    constructor(obj, index, gl, meshProgramInfo) {
        this.gl = gl;
        this.meshProgramInfo = meshProgramInfo;
        this.index = index;
        this.name = obj.name;
        this.href = obj.href;
        this.position = 0;
        this.yRotation = degToRad(0);
        this.rotationSpeed = 3;

        this.render = this.render.bind(this);
    }

    async load() {
        const path = 'data/KayKit_HalloweenBits_1.0_FREE/Assets/obj/'
        this.href = path + this.href;
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

        const textures = {
            defaultWhite: twgl.createTexture(this.gl, { src: [255, 255, 255, 255] }),
            defaultNormal: twgl.createTexture(this.gl, { src: [127, 127, 255, 0] }),
        };

        for (const material of Object.values(this.materials)) {
            Object.entries(material)
                .filter(([key]) => key.endsWith("Map"))
                .forEach(([key, filename]) => {
                    let texture = textures[filename];
                    if (!texture) {
                        const textureHref = new URL(filename, baseHref).href;
                        texture = twgl.createTexture(this.gl, { src: textureHref, flipY: true });
                        textures[filename] = texture;
                    }
                    material[key] = texture;
                });
        }

        Object.values(this.materials).forEach((m) => {
            m.shininess = 25;
            m.specular = [3, 2, 1];
        });

        const defaultMaterial = {
            diffuse: [1, 1, 1],
            diffuseMap: textures.defaultWhite,
            normalMap: textures.defaultNormal,
            ambient: [0, 0, 0],
            specular: [1, 1, 1],
            specularMap: textures.defaultWhite,
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

            if (data.texcoord && data.normal) {
                data.tangent = generateTangents(data.position, data.texcoord);
            } else {
                data.tangent = { value: [1, 0, 0] };
            }

            if (!data.texcoord) {
                data.texcoord = { value: [0, 0] };
            }

            if (!data.normal) {
                data.normal = { value: [0, 0, 1] };
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

        this.cameraTarget = [0, 0, 0];
        const radius = m4.length(range) * 5;
        this.cameraPosition = m4.addVectors(this.cameraTarget, [0, 0, radius]);

        this.zNear = radius / 100;
        this.zFar = radius * 3;

        requestAnimationFrame(this.render);

    }

    render() {
        twgl.resizeCanvasToDisplaySize(this.gl.canvas);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.enable(this.gl.SCISSOR_TEST);

        const viewModel = document.getElementById('model' + String(this.index));

        const rect = viewModel.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        let bottom = this.gl.canvas.clientHeight - top - 281;

        const words = this.name.split(' ');
        if (words[0] == 'Post' && words.length > 1) {
            bottom = this.gl.canvas.clientHeight - top - 385;
        } else 
            if (words[1] == 'Dirt' && words.length > 1) {
                bottom = this.gl.canvas.clientHeight - top - 270;
            } else
                if (words[words.length - 1] == 'Pillar' || words[0] == 'Post') {
                    bottom = this.gl.canvas.clientHeight - top - 295;
                }
        const width = this.gl.canvas.width+15;

        this.gl.viewport(0, bottom, width, this.gl.canvas.height);
        this.gl.scissor(0, bottom, width, this.gl.canvas.height);

        const fieldOfViewRadians = degToRad(60);
        const aspect = this.gl.canvas.clientWidth / this.gl.canvas.clientHeight;
        const projection = m4.perspective(fieldOfViewRadians, aspect, this.zNear, this.zFar);

        const up = [0, 1, 0];
        const camera = m4.lookAt(this.cameraPosition, this.cameraTarget, up);
        const view = m4.inverse(camera);

        const sharedUniforms = {
            u_lightDirection: m4.normalize([-1, 3, 5]),
            u_view: view,
            u_projection: projection,
        };
        this.gl.useProgram(this.meshProgramInfo.program);

        twgl.setUniforms(this.meshProgramInfo, sharedUniforms);

        let u_world = m4.identity();
        u_world = m4.yRotation(this.yRotation);

        for (const { bufferInfo, vao, material } of this.parts) {
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

    insertModel() {   // interface
        const contentElem = document.getElementById('models');
        const viewElem = createElem('div', contentElem, 'view');
        const labelElem = createElem('div', viewElem, 'label');

        labelElem.innerText = this.name;
        labelElem.style.fontSize = "13pt";
        labelElem.style.padding = "1px";
        labelElem.style.backgroundColor = "#013440";
        labelElem.style.color = "white";
        labelElem.style.borderTopRightRadius = "6px";
        labelElem.style.borderTopLeftRadius = "6px";

        viewElem.id = 'model' + String(this.index);
        viewElem.style.border = "1px solid black";
        viewElem.style.borderRadius = "10px";
        viewElem.addEventListener("mouseover", function (event) {
            event.target.style.border = "3px solid #013440";
            event.target.style.fontWeight = "bold";
            event.target.style.cursor = "pointer";
        });
        viewElem.addEventListener("mouseout", function (event) {
            event.target.style.border = "1px solid #013440";
            event.target.style.fontWeight = "normal";
            event.target.style.cursor = "auto";
        });

        if (this.index == 0) { viewElem.style.marginTop = "7px"; }
        viewElem.style.display = "inline-block";
        viewElem.style.width = "240px";
        viewElem.style.height = "125px";
    }

}
