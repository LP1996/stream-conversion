var login = {
  template: `
    <div id="login">
      <span class="login__title">
        转流信息查看
      </span>
      <div class="login__input">
        <label class="label">
          <span class="label__name">用户名</span>
          <input type="text" class="label__input" value="admin">
        </label>
        <label class="label">
          <span class="label__name">密码</span>
          <input type="password" class="label__input" value="123456">
        </label>
        <button class="btn btn-large btn-primary" @click="login">登录</button>
      </div>
    </div>
  `,
  methods: {
    login(e) {
      this.$emit('hide-login');
      location.hash = 'dashboard';
      e.stopPropagation();
    }
  }
};
Vue.component('login', login);

var aside = {
  template: `
    <aside class="aside__nav fl">
      <div class="nav__logo"><img src="assets/img/logo.png"></div>
      <div class="nav__item" :class="dashboard" @click="switchActive"><a href="#dashboard">Dashboard</a></div>
      <div class="nav__item" :class="tasks" @click="switchActive"><a href="#tasks">Tasks</a></div>
    </aside>
  `,
  props: {
    active: {
      type: String,
      required: true
    }
  },
  computed: {
    dashboard() {
      return this.active === 'dashboard' ? 'nav__item--active' : '';
    },
    tasks() {
      return this.active === 'tasks' || this.active === 'log'
        ? 'nav__item--active'
        : '';
    }
  },
  methods: {
    switchActive(e) {
      this.$emit('switch-page', e.target.innerText.toLowerCase());
    }
  }
};
Vue.component('aside-nav', aside);

var dashboard = {
  template: `
    <section class="dashboard" @click="toTask">
      <div class="panel fl">
        <span class="panel__icon"><i class="iconfont icon-task"></i></span>     
        <span class="panel__title">
          <span class="panel__content">{{taskNum}}</span>
          <br>
          <span>任务数量</span>    
        </span>      
      </div>
      <div class="panel fl">
        <span class="panel__icon"><i class="iconfont icon-user"></i></span>
        <span class="panel__title">
          <span class="panel__content">{{watchNum}}</span>
          <br>
          <span>观看人数</span>
        </span>
      </div>
    </section>
  `,
  props: {
    taskNum: {
      type: Number,
      required: true
    },
    watchNum: {
      type: Number,
      required: true
    }
  },
  methods: {
    toTask(e) {
      if (e.target === e.currentTarget) {
        return;
      }
      this.$emit('switch-page', 'tasks');
    }
  }
};
Vue.component('dashboard', dashboard);

var tasks = {
  template: `
    <section class="tasks">
      <button class="btn btn-large btn-primary" @click="addTask">新增任务</button>
      <button style="margin-left:20px" class="btn btn-large btn-primary" @click="stopAllTask">关闭所有</button>
      <div class="task__content">
        <table class="table">
          <colgroup>
            <col>
            <col>
            <col width="150">
            <col width="100">
            <col width="100">
            <col width="168">
          </colgroup>
          <thead class="thead">
            <tr>
              <th>源地址</th>
              <th>转换地址</th>
              <th>操作</th>
              <th>分辨率</th>
              <th>观看人数</th>
              <th>开始时间</th>
            </tr>
          </thead>
          <tbody class="tbody">
            <tr v-if="!data.length" class="noDataTr">
              <td colspan="6">暂无数据</td>
            </tr>
            <tr v-for="(info, index) in data" :key="info.id">
              <td class="break">{{info.origin}}</td>
              <td class="break">{{info.converted | converted}}</td>
              <td>
                <span class="log" title="任务日志" @click="viewLog(index, $event)"><i class="iconfont icon-task"></i></span>
                <span class="stop" title="停止任务" @click="stopTask(info, $event)"><i class="iconfont icon-tingzhi"></i></span>
              </td>
              <td>{{info.resolution | resolution}}</td>
              <td>{{info.shareNum}}</td>
              <td>{{info.startTime}}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `,
  props: {
    data: {
      type: Array,
      required: true
    }
  },
  filters: {
    converted(text) {
      if (typeof text !== 'string') {
        return text.http + '\r\n' + text.ws;
      }
      return text;
    },
    resolution(text) {
      return text === 'origin' ? '原分辨率' : text;
    }
  },
  methods: {
    addTask(e) {
      this.$emit('dialog');
      e.stopPropagation();
    },
    viewLog(index, e) {
      this.$emit('switch-page', 'log');
      this.$emit('set-log', index);
      e.stopPropagation();
    },
    stopTask(info, e) {
      var params = {
        url: info.origin,
        type: info.type === 'flv' ? 'http' : info.type,
        resolution: info.resolution === 'origin' ? '' : info.resolution
      };
      axios
        .post('/pageStop', params)
        .then(function(res) {
          const { code, msg } = res.data;
          if (code !== 200) {
            alert(msg);
          }
        })
        .catch(function(e) {
          console.error(e);
        });
      e.stopPropagation();
    },
    stopAllTask(e) {
      if (this.data.length) {
        var params = {
          url: this.data.map(i => i.origin),
          type: this.data[0].type === 'flv' ? 'http' : this.data[0].type,
          resolution:  this.data[0].resolution === 'origin' ? '' :  this.data[0].resolution
        };
        axios
        .post('/stop', params)
        .then(function(res) {
          const { code, msg } = res.data;
          if (code !== 200) {
            alert(msg);
          }
        })
        .catch(function(e) {
          console.error(e);
        });
      }
    e.stopPropagation();
    }
  }
};
Vue.component('tasks', tasks);

var log = {
  template: `
    <section class="logPage">
      <h3>任务日志</h3>
      <table>
        <colgroup>
          <col width="200">
          <col width="100">
          <col width="200">
        </colgroup>
        <thead>
          <tr>
            <th>url</th>
            <th>分辨率</th>
            <th>开始时间</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{data.origin}}</td>
            <td>{{data.resolution}}</td>
            <td>{{data.startTime}}</td>
          </tr>
        </tbody>
      </table>
      <pre>
        {{data.logs | log}}
      </pre>
    </section>
  `,
  props: {
    data: {
      type: Object
    }
  },
  filters: {
    log(arr) {
      return arr.join('\r\n');
    }
  }
};
Vue.component('log', log);

var dialog = {
  template: `
    <div id="dialog" @click="stop" v-if="visible">
      <div class="dialog__modal" @click="closeDialog"></div>
      <div class="dialog__box">
        <p class="dialog__header">
          <span class="dialog__title">新增任务</span>
          <span @click="closeDialog">×</span>
        </p>
        <div class="dialog__content">
          <select class="select" v-model="form.type">
            <option value="http">http</option>
            <option value="ws">ws</option>
            <option value="hls">hls</option>
          </select>
          <select class="select" v-model="form.resolution">
            <option value="">原分辨率</option>
            <option value="1080">1080</option>
            <option value="720">720</option>
            <option value="480">480</option>
          </select>
          <span>
            <input class="input" type="text" v-model="form.url" placeholder="rtsp地址">
          </span> 
        </div>
        <div class="dialog__footer">
          <button class="btn btn-large btn-primary" @click="submit">确定</button>
        </div>
      </div>
    </div>
  `,
  props: {
    visible: {
      type: Boolean,
      required: true
    }
  },
  data() {
    return {
      form: {
        url: '',
        type: 'http',
        resolution: ''
      }
    };
  },
  methods: {
    closeDialog() {
      this.$emit('update:visible', false);
    },
    submit() {
      console.log(this.form);
      axios
        .post('/convert', this.form)
        .then(function (res) {
          console.log(res);
        })
        .catch(function (e) {
          console.log(e);
        });
      this.resetForm();
    },
    resetForm() {
      this.form = {
        url: '',
        type: 'http',
        resolution: ''
      };
    },
    stop(e) {
      e.stopPropagation();
    }
  }
};
Vue.component('own-dialog', dialog);

var home = {
  template: `
    <div id="home">
      <transition name="fade">
        <login v-if="showLogin" @hide-login="hideLogin"/>
      </transition>
      <aside-nav :active="page" @switch-page="switchPage" />
      <main id="content">
        <transition name="fade" mode="out-in">
          <dashboard v-if="page === 'dashboard'" :task-num="taskNum" :watch-num="watchNum" @switch-page="switchPage"/>
          <tasks v-if="page === 'tasks'" :data="data" @dialog="showDialog" @switch-page="switchPage" @set-log="setLogTask"/>
          <log v-if="page === 'log'" :data="data[logTask]"/>
        </transition>
      </main>
      <own-dialog :visible.sync="dialog" />
    </div>
  `,
  data() {
    return {
      page: 'dashboard',
      data: [],
      dialog: false,
      logTask: null,
      showLogin: true,
      ws: null
    };
  },
  computed: {
    taskNum() {
      return this.data.length;
    },
    watchNum() {
      return this.data.reduce(function (ac, info) {
        return ac + info.shareNum;
      }, 0);
    }
  },
  created() {
    document.addEventListener('click', this.hideDialog, false);
    this.establishWs();
    if (location.hash) {
      if(location.hash.includes('log')) {
        this.switchPage('tasks');
      } else {
        this.switchPage(location.hash.slice(1));
      }
      this.hideLogin();
    }
  },
  methods: {
    switchPage(page) {
      this.page = page;
      location.hash = page;
    },
    setLogTask(index) {
      this.logTask = index;
    },
    hideLogin() {
      this.showLogin = false;
    },
    showDialog() {
      this.dialog = true;
    },
    establishWs() {
      const ws = new WebSocket('ws://localhost:8000/data');
      var that = this;
      ws.onopen = function (m) {
        ws.onmessage = function (e) {
          data = JSON.parse(e.data);
          that.data = data;
        };
        this.ws = ws;
      };
      ws.onerror = function (e) {
        alert('websocket error');
        console.log(e);
      };
      ws.onclose = function (e) {
        console.log('websocket close', e);
      };
    }
  }
};
Vue.component('home', home);

new Vue({ el: '#app', template: '<home />' });
