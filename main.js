function identity(t) {
    return t;
}

function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function interpolate2(start, end, t_start, t_end, t, f=identity) {
    if (t < t_start) t = t_start;
    if (t > t_end) t = t_end;

    t = (t - t_start) / (t_end - t_start);

    t = f(t);

    return {
        x: start.x * (1 - t) + end.x * t,
        y: start.y * (1 - t) + end.y * t
    };
}

class Visualizer {
    constructor() {
        this.scene_render = document.getElementById("scene_render");
        this.scene_settings = document.getElementById("scene_settings");

        this.data_input_container  = document.getElementById("data_input_container");
        this.data_output_container = document.getElementById("data_output_container");
        this.data_extra_container  = document.getElementById("data_extra_container");

        this.canvas = document.getElementById("main_canvas");
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

        // images
        this.background_image = new Image();
        this.background_image.src = "img/background/AdobeStock_391723551.jpeg";

        this.planet_images = new Array(7);
        for (var pi = 1; pi <= 6; pi++) {
            this.planet_images[pi] = new Image();
            this.planet_images[pi].src = `img/planets/${pi}.png`;
        }

        // color scheme
        this.color_scheme = {
            'planet_colors': {
                1: {'fill': 'rgb(255, 255, 255)', 'stroke': 'rgb(190, 190, 190)'},
                2: {'fill': 'rgb(172, 98,  255)', 'stroke': 'rgb(91,  0,   191)'},
                3: {'fill': 'rgb(117, 117, 255)', 'stroke': 'rgb(0,   0,   233)'},
                4: {'fill': 'rgb(239, 228, 176)', 'stroke': 'rgb(255, 200, 14 )'},
                5: {'fill': 'rgb(153, 217, 234)', 'stroke': 'rgb(0,   162, 232)'},
                6: {'fill': 'rgb(255, 125, 213)', 'stroke': 'rgb(217, 0,   147)'},
            },
            'zone_colors': {
                1: {'fill': 'rgba(255, 255, 255, 0.25)', 'stroke': 'rgba(190, 190, 190, 0.25)'},
                2: {'fill': 'rgba(172, 98,  255, 0.25)', 'stroke': 'rgba(91,  0,   191, 0.25)'},
                3: {'fill': 'rgba(117, 117, 255, 0.25)', 'stroke': 'rgba(0,   0,   233, 0.25)'},
                4: {'fill': 'rgba(239, 228, 176, 0.25)', 'stroke': 'rgba(255, 200, 14,  0.25)'},
                5: {'fill': 'rgba(153, 217, 234, 0.25)', 'stroke': 'rgba(0,   162, 232, 0.25)'},
                6: {'fill': 'rgba(255, 125, 213, 0.25)', 'stroke': 'rgba(217, 0,   147, 0.25)'},
            },
            'visited_planet': {'fill': 'rgb(64, 255, 64)', 'stroke': 'green'},
            'ship': {'fill': 'rgb(255, 64, 64)', 'stroke': 'red'}
        }
    }

    updateInputSettings() {
        this.p_input.style.display = "none";
        this.p_input_image.style.display = "none";

        if (this.select_input.value == "custom_input") {
            this.p_input.style.display = "block";
            this.data_input_container.value = "";
            this.data_extra_container.value = "";
        }

        if (this.select_input.value != "custom_input") {
            this.p_input_image.style.display = "block";
            this.input_image.src = `img/input_snapshot/${this.select_input.value}.png`;

            this.data_input_container.value = PRESET_DATA[`input_${this.select_input.value}`];
            this.data_extra_container.value = PRESET_DATA[`extra_${this.select_input.value}`];
        }
    }

    loadData() {
        this.data = {
            vertices: [],
            edges: [],
            path: []
        };

        // prepare canvas_ctx
        this.updateCanvas();

        // load
        this.loadInputData();
        this.loadOutputData();

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
        var extr = this.data_extra_container.value
            .trim()
            .split(/\r?\n/)
            .map((line) => line.trim().split(" ").map((x) => parseInt(x)));

        var planet_colors = extr[0];

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
            var color = (planet_colors[i] || 1);
            var zone_index = 5 * Math.floor(3 * y / this.map_height) + Math.floor(5 * x / this.map_width);

            pos++;

            this.data.vertices.push({"x": x, "y": y, "color": color, "zone_index": zone_index});
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

        this.render_interval = 20;
        this.rel_play_dur = 2000;

        this.current_time_moment = 0;
        
        this.interval_object = setInterval(() => {this.renderStep();}, this.render_interval);

        this.logExportDirectLink();
    }

    renderStep() {
        this.current_time_moment += this.render_interval;

        this.render();
    }

    timeToPath(tm) {
        return tm * this.path_total_w / (this.rel_play_dur * this.render_interval);
    }

    pathToTime(pm) {
        return pm * (this.rel_play_dur * this.render_interval) / this.path_total_w;
    }

    renderStop() {
        clearInterval(this.interval_object);

        this.setScene("settings");
    }

    logExportDirectLink() {
        var data = {
            "select_input_value": this.select_input.value,
            "data_output_container_value": this.data_output_container.value
        };

        console.log("https://atstng.github.io/HamiltonianPathSolVisualizer/index.html?auto=" + btoa(JSON.stringify(data)));
    }

    setScene(scene_name) {
        this.scene_render.style.display = "none";
        this.scene_settings.style.display = "none";

        document.getElementById("scene_" + scene_name).style.display = "block";
    }

    updateCanvas() {
        // constants
        this.map_width = 1800;
        this.map_height = 900;

        this.table_cell_size = 200;
        this.table_width  = 5 * this.table_cell_size;
        this.table_height = 3 * this.table_cell_size;

        this.table_x = this.map_width + 50;
        this.table_y = 0;

        this.total_width = this.map_width + 50 + this.table_width;
        this.total_height = this.map_height;

        // canvas ctx
        this.canvas.width = window.innerWidth - 30;
        this.canvas.height = window.innerHeight - 100;

        var scale_ratio = Math.min(
            this.canvas.width / this.total_width,
            this.canvas.height / this.total_height 
        );

        this.canvas_ctx = this.canvas.getContext("2d");
        this.canvas_ctx.scale(scale_ratio, scale_ratio);
    }

    render() {
        var ctx = this.canvas_ctx;

        var time_moment = this.timeToPath(this.current_time_moment);

        // reset
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.rect(0, 0, this.total_width, this.total_height);
        ctx.fill();

        // background
        ctx.drawImage(this.background_image, 0, 0, 3000 * 0.6, 2000 * 0.6);

        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.rect(0, this.map_height, this.total_width, this.total_height);
        ctx.fill();
        
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
        
        // vertices && zones info
        var currently_visited_planets = 0;
        var zones_info = Array.from(Array(15), () => { return {'vertex': 0, 'visited_at': Infinity}; });

        for (let v of this.vertices) {
            var visited = v.visited_at <= time_moment;
            var cur_zone = zones_info[v.zone_index];

            if (visited) currently_visited_planets += 1;

            if (cur_zone.visited_at > v.visited_at) {
                cur_zone.visited_at = v.visited_at;
                cur_zone.vertex = v;
            }

            this.renderVertex(v, visited, false);
        }
        
        // ship
        if (0 <= time_moment && time_moment < this.path_total_w) {
            this.renderShip(ship_pos);
        }

        // zones
        for (var zone_index = 0; zone_index < 15; zone_index++) {
            var x0 = zone_index % 5;
            var y0 = Math.floor(zone_index / 5);
            var zone = zones_info[zone_index];

            if (zone.visited_at > time_moment) continue;
            
            // visuals
            var zone_width = this.map_width / 5;
            var zone_height = this.map_height / 3;

            this.setColorScheme(this.color_scheme.zone_colors[zone.vertex.color]);
            ctx.beginPath();
            ctx.rect(
                x0 * zone_width, y0 * zone_height,
                zone_width, zone_height
            );
            ctx.fill();
        
            this.setColorScheme(this.color_scheme.planet_colors[zone.vertex.color]);
            ctx.lineWidth = 1;
            ctx.strokeStyle = "black";
            ctx.font = "bold 48px system-ui";
            ctx.fillText(`${zone.vertex.color}`, x0 * zone_width + 5, y0 * zone_height + 50);
            ctx.strokeText(`${zone.vertex.color}`, x0 * zone_width + 5, y0 * zone_height + 50);

            this.renderVertex(zone.vertex, true, true);
        }

        // progress bar
        this.renderProgressBar(time_moment);

        // table
        ctx.fillStyle = "grey";
        ctx.strokeStyle = "grey";

        {
            var x = this.table_x;
            var y = this.table_y;
            var tcs = this.table_cell_size;
            
            for (var j = 0; j <= 5; j++) {
                ctx.beginPath();
                ctx.moveTo(x + j*tcs, y + 0*tcs);
                ctx.lineTo(x + j*tcs, y + 3*tcs);
                ctx.stroke();
            }
            for (var i = 0; i <= 3; i++) {
                ctx.beginPath();
                ctx.moveTo(x + 0*tcs, y + i*tcs);
                ctx.lineTo(x + 5*tcs, y + i*tcs);
                ctx.stroke();
            }
        }

        // planets
        var zones_with_animation_complete = 0;

        for (var zone_index = 0; zone_index < 15; zone_index++) {
            var x0 = zone_index % 5;
            var y0 = Math.floor(zone_index / 5);
            var zone = zones_info[zone_index];

            if (zone.visited_at > time_moment) continue;

            // keyframes
            var kf0 = zone.visited_at;
            var kf1 = kf0 + this.timeToPath(1000);
            var kf2 = kf1 + this.timeToPath(2000);
            
            var zone_width = this.map_width / 5;
            var zone_height = this.map_height / 3;
            
            const tx = this.table_x;
            const ty = this.table_y;
            const tcs = this.table_cell_size;

            var cell_center = {
                x: tx + tcs * (x0 + 0.5),
                y: ty + tcs * (y0 + 0.5)
            };
            var zone_center = {
                x: zone_width * (x0 + 0.5),
                y: zone_height * (y0 + 0.5)
            };

            var p = {x: 0, y: 0};
            var scale = 0.5;

            if (kf0 <= time_moment && time_moment < kf1) {
                p = interpolate2(zone.vertex, zone_center, kf0, kf1, time_moment);
                scale = 0.5 * (time_moment - kf0) / (kf1 - kf0);
            }

            if (kf1 <= time_moment && time_moment < kf2) {
                p = interpolate2(zone_center, cell_center, kf1, kf2, time_moment, easeInOutCubic);
            }

            if (kf2 <= time_moment) {
                zones_with_animation_complete++;
                p = cell_center;
            }
            
            this.renderTablePlanet(p, zone.vertex.color, scale);
        }

        // crossline
        if (zones_with_animation_complete == 15) {
            // seq_by_row contains 8-connected path to the left border
            // that ends in given row or value false if it is not possible
            var seq_by_row = [[0], [1], [2]];
            
            for (let jcur of [1, 2, 3, 4]) {
                var new_seq_by_row = [false, false, false];

                for (let icur of [0, 1, 2]) {
                    for (let idelta of [-1, 0, +1]) {
                        var iprv = icur + idelta;
                        var jprv = jcur - 1;
                        
                        if (iprv < 0) continue;
                        if (iprv >= 3) continue;
                        if (!seq_by_row[iprv]) continue;

                        var cur_color = zones_info[icur*5 + jcur].vertex.color;
                        var prv_color = zones_info[iprv*5 + jprv].vertex.color;

                        if (cur_color != prv_color) continue;

                        new_seq_by_row[icur] = [...seq_by_row[iprv]].concat([icur]);
                        break;
                    }
                }

                seq_by_row = new_seq_by_row;
            }

            console.log(seq_by_row);

            // among computed sequences find first valid one and draw it
            var final_seq = seq_by_row.find(a => a);

            if (final_seq) {
                ctx.lineWidth = 5;
                ctx.strokeStyle = "rgb(64, 255, 64)";

                for (var j = 0; j+1 < 5; j++) {
                    const tx = this.table_x;
                    const ty = this.table_y;
                    const tcs = this.table_cell_size;

                    var i0 = final_seq[j+0];
                    var i1 = final_seq[j+1];

                    ctx.beginPath();
                    ctx.moveTo(tx + tcs * (0.5 + j+0), ty + tcs * (0.5 + i0));
                    ctx.lineTo(tx + tcs * (0.5 + j+1), ty + tcs * (0.5 + i1));
                    ctx.stroke();
                }
            }
        }

        // update status
        var visual_time = Math.min(time_moment, this.path_total_w);

        this.status_line.innerHTML = 
            //`УЧАСТНИК: name_placeholder ` + 
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

    renderVertex(p, visited, highlighted) {
        var ctx = this.canvas_ctx;

        ctx.lineWidth = 1;

        if (visited && highlighted) {
            this.setColorScheme(this.color_scheme.planet_colors[p.color]);
            ctx.strokeStyle = "green";
            ctx.lineWidth = 4;
        } else if (visited) {
            this.setColorScheme(this.color_scheme.visited_planet);
        } else {
            this.setColorScheme(this.color_scheme.planet_colors[p.color]);
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

        this.setColorScheme(this.color_scheme.ship);

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
        
        ctx.lineWidth = 1;

        var bar_progress = this.map_width * Math.min(1, time_moment / this.path_total_w);

        ctx.beginPath();
        ctx.rect(0, 0, bar_progress, 10);
        ctx.fill();
    }

    renderTablePlanet(p, planet_index, scale=0.5) {
        var ctx = this.canvas_ctx;
        var img = this.planet_images[planet_index];

        ctx.drawImage(
            img,
            p.x - scale * (img.width / 2),
            p.y - scale * (img.height / 2),
            scale * img.width,
            scale * img.height
        );
    }

    setColorScheme(scheme) {
        var ctx = this.canvas_ctx;

        ctx.strokeStyle = scheme.stroke;
        ctx.fillStyle   = scheme.fill;
    }

    formatFloat(x) {
        return `${Math.round(x * 1000) / 1000}`;
    }
}

var vis = new Visualizer();

addEventListener("resize", (event) => {vis.updateCanvas(); });