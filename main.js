async function main() {
    const response = await fetch('data/models.json');
    const text = await response.text();
    const objs = JSON.parse(text);

    const models = [];
    let objsOnScene = [];

    const canvasM = document.querySelector("#canvasModels");
    const glModels = canvasM.getContext("webgl2");
    if (!glModels) {
        return;
    }
    twgl.setAttributePrefix("a_");
    const meshProgramInfoModels = twgl.createProgramInfo(glModels, [vertexShader, fragmentShader]);

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

    models.forEach((obj, index) => {
        const model = document.getElementById('model' + String(index));
        model.addEventListener('click', () => {  // click models
            objsOnScene.push(new Obj(obj, objsOnScene.length, [1, 1, 1], [degToRad(0), degToRad(0), degToRad(0)],
                [0, 0, 0], " ", [255, 255, 255], [255, 255, 255], 400, 1,
                gl, meshProgramInfo));
        });
    });

    document.getElementById('save').addEventListener('click', () => {
        const sceneJSON = JSON.stringify(objsOnScene);
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
                    let objs = JSON.parse(conteudoJSON);
                    if (objs) {
                        let i = 0;
                        objs.forEach((obj) => {
                            objsOnScene.push(new Obj(obj, i, obj.scale, obj.rotation, obj.translation, obj.diffuseMap, obj.diffuse, obj.specular, obj.shininess, obj.opacity, gl, meshProgramInfo));
                            i++;
                        });
                    }
                };
                reader.readAsText(file);
            }
        });
    });
}

main();

