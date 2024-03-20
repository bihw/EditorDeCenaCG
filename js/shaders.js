const vertexShaderM = `#version 300 es
  in vec4 a_position;
  in vec3 a_normal;
  in vec2 a_texcoord;
  in vec4 a_color;

  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform mat4 u_world;
  uniform vec3 u_viewWorldPosition;

  out vec3 v_normal;
  out vec3 v_surfaceToView;
  out vec2 v_texcoord;
  out vec4 v_color;

  void main() {
    vec4 worldPosition = u_world * a_position;
    gl_Position = u_projection * u_view * worldPosition;
    v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;
    v_normal = mat3(u_world) * a_normal;
    v_texcoord = a_texcoord;
    v_color = a_color;
  }
`;

const fragmentShaderM = `#version 300 es
  precision highp float;

  in vec3 v_normal;
  in vec3 v_surfaceToView;
  in vec2 v_texcoord;
  in vec4 v_color;

  uniform vec3 diffuse;
  uniform sampler2D diffuseMap;
  uniform vec3 ambient;
  uniform vec3 emissive;
  uniform vec3 specular;
  uniform float shininess;
  uniform float opacity;
  uniform vec3 u_lightDirection;
  uniform vec3 u_ambientLight;

  out vec4 outColor;

  void main () {   
    vec3 normal = normalize(v_normal);

    vec3 surfaceToViewDirection = normalize(v_surfaceToView);
    vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);

    float fakeLight = dot(u_lightDirection, normal) * .5 + .5;
    float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);

    vec4 diffuseMapColor = texture(diffuseMap, v_texcoord);
    vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;
    float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;

    outColor = vec4(
      emissive +
      ambient * u_ambientLight +
      effectiveDiffuse * fakeLight +
      specular * pow(specularLight, shininess),
      effectiveOpacity
    );
  }
`;


const vertexShader = `#version 300 es
  precision highp float;
  
  in vec4 a_position;
  in vec3 a_normal;
  in vec2 a_texcoord;
  in vec4 a_color;

  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform mat4 u_world;
  uniform vec3 u_viewWorldPosition;
  uniform vec3 u_lightDirection[5];
  uniform highp int u_lights;
  
  out vec3 v_normal;
  out vec3 v_surfaceToView;
  out vec2 v_texcoord;
  out vec4 v_color;
  out vec3 v_lightPosition[5];

  void main() {
    vec4 worldPosition = u_world * a_position;
    gl_Position = u_projection * u_view * worldPosition;
    v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;
    v_normal = mat3(u_world) * a_normal;
    v_texcoord = a_texcoord;
    v_color = a_color;
    
    for (int i = 0; i < u_lights; i++) {
      v_lightPosition[i] = u_lightDirection[i] - worldPosition.xyz;
    }
  }
`;

const fragmentShader = `#version 300 es
  precision highp float;

  in vec3 v_normal;
  in vec3 v_surfaceToView;
  in vec2 v_texcoord;
  in vec4 v_color;
  in vec3 v_lightPosition[5];

  uniform vec3 diffuse;
  uniform sampler2D diffuseMap;
  uniform vec3 emissive;
  uniform vec3 ambient;
  uniform vec3 specular;
  uniform float shininess;
  uniform float opacity;
  uniform vec3 u_ambientLight;

  uniform vec3 u_colorLight[5];
  uniform float u_lightIntensity[5];
  uniform highp int u_lights;
  
  out vec4 outColor;

  void main () {
    vec3 normal = normalize(v_normal);
    vec3 surfaceToViewDirection = normalize(v_surfaceToView);

    vec3 finalColor = vec3(0.0); 

    vec3 ambientColor = vec3(0.0);
    vec3 specularColor = vec3(0.0); 
    
    for (int i = 0; i < u_lights; i++) { 
      vec3 ld = normalize(v_lightPosition[i]);
      float df = max(dot(normal, ld), 0.0);
      finalColor += diffuse * df * u_lightIntensity[i];
      
      vec3 halfVector = normalize(ld + surfaceToViewDirection);
      float specularFactor = pow(max(dot(normal, halfVector), 0.0), shininess * 0.3);
      specularColor += specular * specularFactor * u_lightIntensity[i] * u_colorLight[i]; 
    }
  
    ambientColor = ambientColor + u_ambientLight;
    finalColor = finalColor + ambientColor * ambient;
    vec4 diffuseMapColor = texture(diffuseMap, v_texcoord);
    finalColor = finalColor * diffuseMapColor.rgb;
    finalColor = finalColor + specularColor;
    finalColor = finalColor / float(u_lights);
    float finalOpacity = opacity * diffuseMapColor.a;

    outColor = vec4(finalColor, finalOpacity);
  }
`;

const fragmentShaderToon = `#version 300 es
  precision highp float;

  in vec3 v_normal;
  in vec3 v_surfaceToView;
  in vec2 v_texcoord;
  in vec4 v_color;
  in vec3 v_lightPosition[5];

  uniform vec3 diffuse;
  uniform sampler2D diffuseMap;
  uniform vec3 emissive;
  uniform vec3 ambient;
  uniform vec3 specular;
  uniform float shininess;
  uniform float opacity;
  uniform vec3 u_ambientLight;

  uniform vec3 u_colorLight[5];
  uniform float u_lightIntensity[5];
  uniform highp int u_lights;
  uniform int u_toonShader;
  
  out vec4 outColor;

  void main () {
    vec3 normal = normalize(v_normal);
    vec3 surfaceToViewDirection = normalize(v_surfaceToView);

    vec3 finalColor = vec3(0.0); 
    vec3 specularColor = vec3(0.0); 
    vec3 ambientColor = vec3(0.0);
    float totalDiffuseFactor = 0.0; 
    float step = 1.0;
    for (int i = 0; i < u_lights; i++) { 
      vec3 ld = normalize(v_lightPosition[i]);
      totalDiffuseFactor += max(dot(normal, ld), 0.0);

      float nSteps = 9.0;
      step = sqrt(totalDiffuseFactor) * nSteps;
      step = (floor(step) + smoothstep(0.48, 0.52, fract(step))) / nSteps;
      
      float df = max(dot(normal, ld), 0.0);
      finalColor += diffuse * step * df * u_lightIntensity[i];
      vec3 halfVector = normalize(ld + surfaceToViewDirection);
      float specularFactor = pow(max(dot(normal, halfVector), 0.0), shininess * 0.3);
      specularColor += specular * specularFactor * u_lightIntensity[i] * u_colorLight[i]; 
    }

    ambientColor = ambientColor + u_ambientLight;
    finalColor = finalColor + ambientColor * ambient;
    vec4 diffuseMapColor = texture(diffuseMap, v_texcoord);
    finalColor = finalColor * diffuseMapColor.rgb;
    finalColor = finalColor + specularColor;
    finalColor = finalColor / float(u_lights);
    float finalOpacity = opacity * diffuseMapColor.a;

    outColor = vec4(finalColor, finalOpacity);
  }
`;
