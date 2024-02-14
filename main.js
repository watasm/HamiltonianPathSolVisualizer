

class Visualizer {
    constructor() {
        this.scene_render = document.getElementById("scene_render");
        this.scene_settings = document.getElementById("scene_settings");

        this.data_input_container  = document.getElementById("data_input_container");
        this.data_output_container = document.getElementById("data_output_container");

        this.canvas = document.getElementById("main_canvas");
        this.canvas_ctx = this.canvas.getContext("2d");
        this.status_line = document.getElementById("status_line");

        this.p_select_input  = document.getElementById("p_select_input");
        this.select_input    = document.getElementById("select_input");
        this.p_input_image   = document.getElementById("p_input_image");
        this.input_image     = document.getElementById("input_image");
        this.p_input         = document.getElementById("p_input");
        this.p_select_output = document.getElementById("p_select_output");
        this.select_output   = document.getElementById("select_output");
        this.p_output        = document.getElementById("p_output");
        this.p_start_button  = document.getElementById("p_start_button");

        // backgrounds
        this.background_image = new Image();
        this.background_image.src = "img/background/AdobeStock_391723551.jpeg";
    }

    updateInputSettings() {
        this.p_input.style.display = "none";
        this.p_input_image.style.display = "none";

        if (this.select_input.value == "custom_input") {
            this.p_input.style.display = "block";
            this.data_input_container.value = "";
        }

        if (this.select_input.value != "custom_input") {
            this.p_input_image.style.display = "block";
            this.input_image.src = `img/input_snapshot/${this.select_input.value}.png`;

            this.data_input_container.value = PRESET_DATA[`input_${this.select_input.value}`];
        }
        
    }

    loadData() {
        this.data = {
            vertices: [],
            edges: [],
            path: []
        };

        this.loadInputData();
        this.loadOutputData();

        // constants
        this.width = 1800;
        this.height = 900;

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // adjust data
        this.data.path = this.data.path.map((x) => x - 1);

        this.vertices = this.data.vertices;
        this.edges    = this.data.edges;
        this.path     = this.data.path;
        
        this.n = this.vertices.length;
        this.m = this.edges.length;
        this.k = this.path.length;

        this.graph = Array.from(Array(this.n), () => new Array(this.n));

        for (let v of this.vertices) {
            v.visited_at = Infinity;
        }

        this.edges_total_w = 0;
        for (let e of this.edges) {
            e.a -= 1;
            e.b -= 1;
            e.visited_at = Infinity;

            this.graph[e.a][e.b] = e;
            this.graph[e.b][e.a] = e;

            this.edges_total_w += e.w;
        }

        this.vertices[this.path[0]].visited_at = 0;
        
        this.path_total_w = 0;
        for (var i = 0; i+1 < this.k; i++) {
            var a = this.path[i];
            var b = this.path[i+1];
            var av = this.vertices[a];
            var bv = this.vertices[b];
            var e = this.graph[a][b];
            
            this.path_total_w += e.w;
            e.visited_at = Math.min(e.visited_at, this.path_total_w);
            bv.visited_at = Math.min(bv.visited_at, this.path_total_w);
        }

        this.final_score = Math.floor(this.edges_total_w * 100000 / this.path_total_w);

        console.log(this);
    }

    loadInputData() {
        var inp = this.data_input_container.value
            .trim()
            .split(/\r?\n/)
            .map((line) => line.trim().split(" ").map((x) => parseInt(x)));

        //console.log(inp);

        var pos = 0;
        var n = parseInt(inp[pos][0]); pos++;

        for (var i = 0; i < n; i++) {
            var x = inp[pos][0];
            var y = inp[pos][1];
            pos++;

            this.data.vertices.push({"x": x, "y": y});
        }

        var m = parseInt(inp[pos][0]); pos++;

        for (var i = 0; i < m; i++) {
            var a = inp[pos][0];
            var b = inp[pos][1];
            var w = inp[pos][2];
            pos++;

            this.data.edges.push({"a": a, "b": b, "w": w});
        }

        this.assert(n == this.data.vertices.length, "n == this.data.vertices.length");
        this.assert(m == this.data.edges.length, "m == this.data.edges.length");
        this.assert(pos == inp.length, "pos == inp.length");
    }

    loadOutputData() {
        var outp = this.data_output_container.value
            .trim()
            .split(/\r?\n/)
            .map((line) => line.trim().split(" ").map((x) => parseInt(x)));

        console.log(outp);

        var pos = 0;
        var k = parseInt(outp[pos][0]); pos++;

        for (let x of outp[pos]) {
            this.data.path.push(x);
        }
        pos++;

        console.log(pos, outp.length);
        console.log(k, this.data.path.length);

        this.assert(pos == outp.length, "pos == outp.length");
        this.assert(k == this.data.path.length, "k == this.data.path.length");
    }

    assert(cond, comment) {
        if (cond) return;

        alert(`Некорректные данные. Assertion failed: ${comment}`);
    }

    renderStart() {
        this.setScene("render");

        this.current_time_moment = 0;

        this.interval_object = setInterval(() => {this.renderStep();}, 20);
    }

    renderStep() {
        this.current_time_moment += this.path_total_w / 1000;

        this.render(this.current_time_moment);
    }

    renderStop() {
        clearInterval(this.interval_object);

        this.setScene("settings");
    }

    setScene(scene_name) {
        this.scene_render.style.display = "none";
        this.scene_settings.style.display = "none";

        document.getElementById("scene_" + scene_name).style.display = "block";
    }

    render(time_moment) {
        var ctx = this.canvas_ctx;

        // background & reset
        ctx.drawImage(this.background_image, 0, 0, 3000 / 1.5, 2000 / 1.5);
        
        // edges
        for (let draw_visited of [false, true])  {
            for (let e of this.edges) {
                var av = this.vertices[e.a];
                var bv = this.vertices[e.b];
                
                if (draw_visited == (e.visited_at <= time_moment)) {
                    this.renderLine(av, bv, draw_visited);
                }
            }
        }

        // edge part and ship position
        var ship_pos = {x: 0, y: 0};
        var a_visited_at = 0;
        var b_visited_at = 0;

        for (var i = 0; i+1 < this.k; i++) {
            var a = this.path[i];
            var b = this.path[i+1];
            var av = this.vertices[a];
            var bv = this.vertices[b];
            var e = this.graph[a][b];
            
            b_visited_at = a_visited_at + e.w;

            if (a_visited_at <= time_moment && time_moment < b_visited_at) {
                var w_inside_edge = time_moment - a_visited_at;
                var coef = w_inside_edge / e.w;
                
                var d = {
                    x: bv.x - av.x,
                    y: bv.y - av.y
                };
                
                ship_pos = {
                    x: av.x + d.x * coef,
                    y: av.y + d.y * coef
                };

                this.renderLine(av, ship_pos, true);
            }

            // move to next
            a_visited_at = b_visited_at;
        }
        
        // vertices
        var currently_visited_planets = 0;

        for (let v of this.vertices) {
            var visited = v.visited_at <= time_moment;

            if (visited) currently_visited_planets += 1;

            this.renderVertex(v, visited);
        }
        
        // ship
        if (0 <= time_moment && time_moment < this.path_total_w) {
            this.renderShip(ship_pos);
        }

        // progress bar
        this.renderProgressBar(time_moment);

        // update status
        var visual_time = Math.min(this.current_time_moment, this.path_total_w);

        this.status_line.innerHTML = 
            `УЧАСТНИК: name_placeholder ` + 
            `РЕЗУЛЬТАТ: ${this.final_score} ` + 
            `ПЛАНЕТЫ: ${currently_visited_planets} / ${this.n} ` +
            `ВРЕМЯ: ${this.formatFloat(visual_time)}`;
    }

    renderLine(p1, p2, visited) {
        var ctx = this.canvas_ctx;

        if (visited) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgb(64, 255, 64)";
        } else {
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgb(80, 80, 80)";
        }

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }

    renderVertex(p, visited) {
        var ctx = this.canvas_ctx;

        ctx.lineWidth = 1;

        if (visited) {
            ctx.fillStyle = "rgb(64, 255, 64)";
            ctx.strokeStyle = "green";
        } else {
            ctx.fillStyle = "white";
            ctx.strokeStyle = "rgb(255, 189, 250)";
        }

        const radius = 8;

        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2, true);
        ctx.stroke();
    }

    renderShip(p) {
        var ctx = this.canvas_ctx;
        
        ctx.lineWidth = 1;

        ctx.fillStyle = "rgb(255, 64, 64)";
        ctx.strokeStyle = "red";

        const radius = 8;

        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2, true);
        ctx.stroke();
    }

    renderProgressBar(time_moment) {
        var ctx = this.canvas_ctx;

        ctx.strokeStyle = "rgb(64, 255, 64)";
        ctx.fillStyle = "rgb(64, 255, 64)";

        ctx.beginPath();
        ctx.rect(0, 0, this.width * time_moment / this.path_total_w, 10);
        ctx.fill();
    }

    formatFloat(x) {
        return `${Math.round(x * 1000) / 1000}`;
    }
}

var vis = new Visualizer();
