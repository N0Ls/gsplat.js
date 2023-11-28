import type { Camera } from "../cameras/Camera";
import type { Scene } from "../core/Scene";

import SortWorker from "web-worker:./webgl/utils/Worker.ts";

import { vertex } from "./webgl/shaders/vertex.glsl";
import { frag } from "./webgl/shaders/frag.glsl";
import { ShaderPass } from "./webgl/passes/ShaderPass";
import { FadeInPass } from "./webgl/passes/FadeInPass";
import { Matrix4, Vector3 } from "../index";

export class WebGLRenderer {
    domElement: HTMLCanvasElement;
    gl: WebGL2RenderingContext;
    time: number = 0;
    mousePosition: { x: number; y: number } = { x: 0, y: 0 };
    mouseDownPosition: { x: number; y: number } = { x: 0, y: 0 };

    tf: WebGLTransformFeedback;
    length: number = 0;
    targetPosBuffer: WebGLBuffer;
    vao: WebGLVertexArrayObject | null = null;

    a = [1, 2, 3];

    resize: () => void;
    setSize: (width: number, height: number) => void;
    render: (scene: Scene, camera: Camera) => void;
    dispose: () => void;
    private _sourceBuffer: WebGLBuffer | null;
    _computeBuffers: any[];
    _feedback: any[];
    _idx: number = 0;
    bufferSum: WebGLBuffer;
    loaded: boolean = false;

    constructor(optionalCanvas: HTMLCanvasElement | null = null, optionalShaderPasses: ShaderPass[] | null = null) {
        const canvas: HTMLCanvasElement = optionalCanvas || document.createElement("canvas");
        if (!optionalCanvas) {
            canvas.style.display = "block";
            canvas.style.boxSizing = "border-box";
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            canvas.style.margin = "0";
            canvas.style.padding = "0";
            document.body.appendChild(canvas);
        }
        canvas.style.background = "#000";
        this.domElement = canvas;

        const gl = canvas.getContext("webgl2", { antialias: false }) as WebGL2RenderingContext;
        this.gl = gl;

        // this.tf = gl.createTransformFeedback() as WebGLTransformFeedback;

        const shaderPasses = optionalShaderPasses || [];
        if (!optionalShaderPasses) {
            shaderPasses.push(new FadeInPass());
        }

        let activeScene: Scene;
        let activeCamera: Camera;

        let worker: Worker;

        let vertexShader: WebGLShader;
        let fragmentShader: WebGLShader;
        let program: WebGLProgram;

        let u_projection: WebGLUniformLocation;
        let u_viewport: WebGLUniformLocation;
        let u_focal: WebGLUniformLocation;
        let u_view: WebGLUniformLocation;
        let u_texture: WebGLUniformLocation;
        let u_time: WebGLUniformLocation;

        let positionAttribute: number;
        let indexAttribute: number;

        let vertexBuffer: WebGLBuffer;
        let centerBuffer: WebGLBuffer;
        let colorBuffer: WebGLBuffer;
        let covABuffer: WebGLBuffer;
        let covBBuffer: WebGLBuffer;

        let initialized = false;

        //add mouse move event listener
        canvas.addEventListener("mousemove", (e) => {
            this.mousePosition.x = e.clientX;
            this.mousePosition.y = e.clientY;
        });

        // add mouse down event listener

        canvas.addEventListener("mousedown", (e) => {
            this.mouseDownPosition.x = e.clientX;
            this.mouseDownPosition.y = e.clientY;

            //update boolean in shader
            gl.uniform1i(gl.getUniformLocation(program, "clicked"), 1);
        });

        // add mouse up event listener

        canvas.addEventListener("mouseup", (e) => {
            //check if mouse has moved with a delta
            const deltaX = Math.abs(this.mouseDownPosition.x - e.clientX);
            const deltaY = Math.abs(this.mouseDownPosition.y - e.clientY);
            if (deltaX > 5 || deltaY > 5) {
                //mouse has moved
                return;
            }

            // update boolean in shader
            gl.uniform1i(gl.getUniformLocation(program, "clicked"), 0);

            const ndcX = (this.mousePosition.x / canvas.width) * 2 - 1;
            const ndcY = -(this.mousePosition.y / canvas.height) * 2 + 1;

            // Create a new Vector3 in clip space
            const clipSpacePosition = new Vector3(ndcX, ndcY, 1);

            // Use the inverse of the projection matrix to transform the point to world space
            const inverseProjectionMatrix = Matrix4.invert(activeCamera.viewProj);
            let rayDirection = clipSpacePosition.transformMat4(inverseProjectionMatrix);

            const rayPos = activeCamera.position;

            rayDirection = rayDirection.subtract(rayPos);

            // Normalize the direction
            rayDirection = rayDirection.normalize();

            // this.intersect(rayPos, rayDirection3, new Vector3(0, 0, 0), 0.5);

            //pass to shader
            gl.uniform3f(
                gl.getUniformLocation(program, "rayDirection"),
                rayDirection.x,
                rayDirection.y,
                rayDirection.z,
            );

            gl.uniform3f(
                gl.getUniformLocation(program, "cameraPosition"),
                activeCamera.position.x,
                activeCamera.position.y,
                activeCamera.position.z,
            );

            //send camera position to shader
            gl.uniform3f(
                gl.getUniformLocation(program, "cameraPosition"),
                activeCamera.position.x,
                activeCamera.position.y,
                activeCamera.position.z,
            );

            // Create a new Ray with the camera position as the origin and the calculated direction
            // const ray = new Ray(activeCamera.position, rayDirection);
        });

        this.resize = () => {
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            if (canvas.width !== width || canvas.height !== height) {
                this.setSize(width, height);
            }
        };

        this.setSize = (width: number, height: number) => {
            canvas.width = width;
            canvas.height = height;

            if (!activeCamera) return;

            gl.viewport(0, 0, canvas!.width, canvas.height);
            activeCamera.update(canvas.width, canvas.height);

            u_projection = gl.getUniformLocation(program, "projection") as WebGLUniformLocation;
            gl.uniformMatrix4fv(u_projection, false, activeCamera.projectionMatrix.buffer);

            u_viewport = gl.getUniformLocation(program, "viewport") as WebGLUniformLocation;
            gl.uniform2fv(u_viewport, new Float32Array([canvas.width, canvas.height]));
        };

        const initWebGL = () => {
            console.log("Initializing WebGL");
            worker = new SortWorker();
            const serializedScene = {
                positions: activeScene.positions,
                vertexCount: activeScene.vertexCount,
            };
            worker.postMessage({ scene: serializedScene });

            gl.viewport(0, 0, canvas.width, canvas.height);

            vertexShader = gl.createShader(gl.VERTEX_SHADER) as WebGLShader;
            gl.shaderSource(vertexShader, vertex);
            gl.compileShader(vertexShader);
            if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
                console.error(gl.getShaderInfoLog(vertexShader));
            }

            fragmentShader = gl.createShader(gl.FRAGMENT_SHADER) as WebGLShader;
            gl.shaderSource(fragmentShader, frag);
            gl.compileShader(fragmentShader);
            if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
                console.error(gl.getShaderInfoLog(fragmentShader));
            }

            program = gl.createProgram() as WebGLProgram;
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.transformFeedbackVaryings(program, ["oParticlePosition"], gl.INTERLEAVED_ATTRIBS);
            gl.linkProgram(program);
            gl.useProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error(gl.getProgramInfoLog(program));
            }

            // Create a vertex array object (attribute state)
            this.vao = gl.createVertexArray();
            gl.bindVertexArray(this.vao);

            gl.disable(gl.DEPTH_TEST);
            gl.enable(gl.BLEND);
            gl.blendFuncSeparate(gl.ONE_MINUS_DST_ALPHA, gl.ONE, gl.ONE_MINUS_DST_ALPHA, gl.ONE);
            gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);

            activeCamera.update(canvas.width, canvas.height);

            u_projection = gl.getUniformLocation(program, "projection") as WebGLUniformLocation;
            gl.uniformMatrix4fv(u_projection, false, activeCamera.projectionMatrix.buffer);

            u_viewport = gl.getUniformLocation(program, "viewport") as WebGLUniformLocation;
            gl.uniform2fv(u_viewport, new Float32Array([canvas.width, canvas.height]));

            u_focal = gl.getUniformLocation(program, "focal") as WebGLUniformLocation;
            gl.uniform2fv(u_focal, new Float32Array([activeCamera.fx, activeCamera.fy]));

            u_view = gl.getUniformLocation(program, "view") as WebGLUniformLocation;
            gl.uniformMatrix4fv(u_view, false, activeCamera.viewMatrix.buffer);

            u_time = gl.getUniformLocation(program, "uTime") as WebGLUniformLocation;
            gl.uniform1f(u_time, this.time);

            const triangleVertices = new Float32Array([-2, -2, 2, -2, 2, 2, -2, 2]);
            vertexBuffer = gl.createBuffer() as WebGLBuffer;
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);

            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);

            u_texture = gl.getUniformLocation(program, "u_texture") as WebGLUniformLocation;
            gl.uniform1i(u_texture, 0);

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA32UI,
                activeScene.width,
                activeScene.height,
                0,
                gl.RGBA_INTEGER,
                gl.UNSIGNED_INT,
                activeScene.data,
            );
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);

            // TRANSFORM FEEDBACK

            this._sourceBuffer = gl.createBuffer() as WebGLBuffer;
            const aParticleSourcePositionLoc = gl.getAttribLocation(program, "aParticleSourcePosition");
            gl.bindBuffer(gl.ARRAY_BUFFER, this._sourceBuffer);
            gl.enableVertexAttribArray(aParticleSourcePositionLoc);
            gl.vertexAttribPointer(aParticleSourcePositionLoc, 3, gl.FLOAT, false, 0, 0);

            // setup our attributes to tell WebGL how to pull

            positionAttribute = gl.getAttribLocation(program, "position");
            gl.enableVertexAttribArray(positionAttribute);
            gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);

            const indexBuffer = gl.createBuffer() as WebGLBuffer;
            indexAttribute = gl.getAttribLocation(program, "index");
            gl.enableVertexAttribArray(indexAttribute);
            gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
            gl.vertexAttribIPointer(indexAttribute, 1, gl.INT, 0, 0);
            gl.vertexAttribDivisor(indexAttribute, 1);

            // this._computeBuffers = [createComputeBuffer(gl), createComputeBuffer(gl)];

            this.bufferSum = createComputeBuffer(gl, activeScene.vertexCount);

            this.tf = makeTransformFeedback(this.bufferSum) as WebGLTransformFeedback;

            // this._feedback = [
            //     makeTransformFeedback(this._computeBuffers[0]),
            //     makeTransformFeedback(this._computeBuffers[1]),
            // ];
            // generate array of size a times active scene vertex count
            const a = new Array(activeScene.vertexCount * 3).fill(1);
            // put data in buffers
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.STATIC_DRAW);

            gl.bindBuffer(gl.ARRAY_BUFFER, this._sourceBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.STATIC_DRAW);
            // const aBuffer = makeBufferAndSetAttribute(gl, new Float32Array(this.a), aLoc);

            // Create and fill out a transform feedback
            gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tf);

            // make buffers for output

            // bind the buffers to the transform feedback
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.bufferSum);

            gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

            // buffer's we are writing to can not be bound else where
            gl.bindBuffer(gl.ARRAY_BUFFER, null); // productBuffer was still bound to ARRAY_BU

            // console.log(this.vao);
            // ==================================================

            function createComputeBuffer(gl: WebGL2RenderingContext, size: number) {
                console.log(size);
                const buff = gl.createBuffer() as WebGLBuffer;
                gl.bindBuffer(gl.ARRAY_BUFFER, buff);
                gl.bufferData(gl.ARRAY_BUFFER, 3 * 4 * size, gl.STATIC_DRAW);
                positionAttribute = gl.getAttribLocation(program, "aParticlePosition");
                gl.enableVertexAttribArray(positionAttribute);
                gl.vertexAttribPointer(positionAttribute, 3, gl.FLOAT, false, 0, 0);
                return buff;
            }

            function makeTransformFeedback(buffer: WebGLBuffer) {
                const tf = gl.createTransformFeedback();

                gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
                gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffer);

                const transformFeedbackOutputs = ["oParticlePosition"];
                gl.transformFeedbackVaryings(program, transformFeedbackOutputs, gl.INTERLEAVED_ATTRIBS);

                gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

                return tf;
            }

            for (const shaderPass of shaderPasses) {
                shaderPass.init(this, program);
            }

            worker.onmessage = (e) => {
                if (e.data.depthIndex) {
                    const { depthIndex } = e.data;
                    gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
                    gl.bufferData(gl.ARRAY_BUFFER, depthIndex, gl.STATIC_DRAW);
                    this.loaded = true;
                }
            };

            initialized = true;
        };

        const onSceneChange = () => {
            if (initialized) {
                this.dispose();
            }

            initWebGL();
        };

        this.render = (scene: Scene, camera: Camera) => {
            if (scene !== activeScene || camera !== activeCamera) {
                if (initialized) {
                    this.dispose();
                }

                activeCamera = camera;

                if (scene !== activeScene) {
                    if (activeScene) {
                        activeScene.removeEventListener("change", onSceneChange);
                    }
                    activeScene = scene;
                    activeScene.addEventListener("change", onSceneChange);
                }

                initWebGL();
            }

            activeCamera.update(canvas.width, canvas.height);
            worker.postMessage({ viewProj: activeCamera.viewProj });

            if (activeScene.vertexCount > 0 && this.loaded) {
                //update time
                this.time += 1 / 60;
                // console.log(this.time);
                gl.uniform1f(u_time, this.time);

                //update mouse position

                gl.uniform2f(gl.getUniformLocation(program, "mouse"), this.mousePosition.x, this.mousePosition.y);

                for (const shaderPass of shaderPasses) {
                    shaderPass.render();
                }
                gl.uniformMatrix4fv(u_view, false, activeCamera.viewMatrix.buffer);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, activeScene.vertexCount);

                gl.useProgram(program);
                // bind our input attribute state for the a and b buffers
                gl.bindVertexArray(this.vao);

                const sbuff = this._sourceBuffer as WebGLBuffer;
                const rbuff = this.bufferSum;

                gl.enable(gl.RASTERIZER_DISCARD);

                gl.bindBuffer(gl.ARRAY_BUFFER, sbuff);
                gl.vertexAttribPointer(positionAttribute, 3, gl.FLOAT, false, 0, 0);

                gl.bindBuffer(gl.ARRAY_BUFFER, rbuff);
                gl.vertexAttribPointer(positionAttribute, 3, gl.FLOAT, false, 0, 0);

                gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tf);
                gl.beginTransformFeedback(gl.POINTS);
                gl.drawArrays(gl.POINTS, 0, activeScene.vertexCount);
                gl.endTransformFeedback();
                gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

                gl.disable(gl.RASTERIZER_DISCARD);
                this._idx = 1.0 - this._idx;

                // this.printResults(gl, this.bufferSum, "sum", 3);
            } else {
                gl.clear(gl.COLOR_BUFFER_BIT);
            }
        };

        this.dispose = () => {
            if (!initialized) return;

            worker.terminate();

            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            gl.deleteProgram(program);

            gl.deleteBuffer(vertexBuffer);
            gl.deleteBuffer(centerBuffer);
            gl.deleteBuffer(colorBuffer);
            gl.deleteBuffer(covABuffer);
            gl.deleteBuffer(covBBuffer);

            initialized = false;
        };

        this.resize();
    }

    printResults(gl: WebGL2RenderingContext, buffer: any, label: string, a: number) {
        const results = new Float32Array(a);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.getBufferSubData(
            gl.ARRAY_BUFFER,
            0, // byte offset into GPU buffer,
            results,
        );
        // print the results
        console.log(`${label}: ${results}`);
    }

    intersect(rayPos: Vector3, rayDir: Vector3, spherePos: Vector3, sphereRadius: number): boolean {
        // Step 1
        const oc = spherePos.subtract(rayPos);

        // Step 2
        const t = oc.dot(rayDir);

        // Step 3
        if (t < 0) {
            console.log("t < 0");
            console.log("sphere behind camera");
            return false;
        }

        // Step 4
        const r2 = sphereRadius * sphereRadius;
        const oc2 = oc.dot(oc);
        const h2 = oc2 - t * t;

        // Step 5
        if (h2 > r2) {
            console.log("h2 > r2");
            console.log("ray misses sphere");
            return false;
        }

        // Step 6
        const h = Math.sqrt(r2 - h2);
        const t0 = t - h;
        const t1 = t + h;

        // Return the closest intersection point
        console.log(rayPos.add(rayDir.multiply(t0)));
        return true;
    }
}
