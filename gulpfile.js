// generated on 2021-05-06 using generator-webapp 4.0.0-8
const { src, dest, watch, series, parallel, lastRun } = require('gulp');
const gulpLoadPlugins = require('gulp-load-plugins');
const browserSync = require('browser-sync');
const del = require('del');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const sass = require('gulp-dart-sass');
const { argv } = require('yargs');

const $ = gulpLoadPlugins();
const server = browserSync.create();

const port = argv.port || 9000;

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const isDev = !isProd && !isTest;

function styles() {
  return src('styles/*.scss', {
    sourcemaps: !isProd,
  })
    .pipe($.plumber())
    .pipe(sass.sync({
      outputStyle: 'expanded',
      precision: 10,
      includePaths: ['.']
    }).on('error', sass.logError))
    .pipe($.postcss([
      autoprefixer()
    ]))
    .pipe(dest('.tmp/styles', {
      sourcemaps: !isProd,
    }))
    .pipe(server.reload({stream: true}));
};

function scripts() {
 return src('scripts/**/*.js', {
   sourcemaps: !isProd,
  })
    .pipe($.plumber())
    .pipe(dest('.tmp/scripts', {
      sourcemaps: !isProd ? '.' : false,
    }))
    .pipe(server.reload({stream: true}));
};


const lintBase = (files, options) => {
  return src(files)
    .pipe($.eslint(options))
    .pipe(server.reload({stream: true, once: true}))
    .pipe($.eslint.format())
    .pipe($.if(!server.active, $.eslint.failAfterError()));
}
function lint() {
  return lintBase('scripts/**/*.js', { fix: true })
    .pipe(dest('scripts'));
};

function html() {
  return src('*.html')
    .pipe($.useref({searchPath: ['.tmp', '.']}))
    .pipe($.if(/\.js$/, $.uglify({compress: {drop_console: true}})))
    .pipe($.if(/\.css$/, $.postcss([cssnano({safe: true, autoprefixer: false})])))
    .pipe($.if(/\.html$/, $.htmlmin({
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: {compress: {drop_console: true}},
      processConditionalComments: true,
      removeComments: true,
      removeEmptyAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true
    })))
    .pipe(dest('dist'));
}

function images() {
  return src('images/**/*', { since: lastRun(images) })
    .pipe($.imagemin())
    .pipe(dest('dist/images'));
};

function extras() {
  return src([
    '*',
    '!*.html'
  ], {
    dot: true
  }).pipe(dest('dist'));
};

function clean() {
  return del(['.tmp', 'dist'])
}

function measureSize() {
  return src('dist/**/*')
    .pipe($.size({title: 'build', gzip: true}));
}

const build = series(
  clean,
  parallel(
    lint,
    series(parallel(styles, scripts), html),
    images,
    extras
  ),
  measureSize
);

function startAppServer() {
  server.init({
    notify: false,
    port,
    server: {
      baseDir: ['.tmp', '.'],
      routes: {
        '/node_modules': 'node_modules'
      }
    }
  });

  watch([
    '*.html',
    'images/**/*',
  ]).on('change', server.reload);

  watch('styles/**/*.scss', styles);
  watch('scripts/**/*.js', scripts);
}

let serve;
if (isDev) {
  serve = series(clean, parallel(styles, scripts), startAppServer);
} else if (isTest) {
  serve = series(clean, scripts, startTestServer);
} else if (isProd) {
  serve = series(build, startDistServer);
}

exports.serve = serve;
exports.build = build;
exports.default = build;
