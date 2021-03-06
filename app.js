var myApp = angular.module('myApp', []);

//myApp.directive('myDirective', function() {});
//myApp.factory('myService', function() {});

function MyCtrl($scope, imageService) {
    $scope.name = 'Superhero';
    var img = new Image();
    img.src = 'pic.png';
    resizeWidth = 200;
    resizeHeight = 200;
    img.onload = function () {
        var test = imageService.resize(img, resizeWidth, resizeHeight).then(function (option) {
            var cnx1=document.createElement('canvas');
            cnx1.width=resizeWidth;
            cnx1.height=resizeHeight;
            var mtx=cnx1.getContext('2d');
            mtx.drawImage(option, 0, 0);

            cnx2=document.createElement('canvas');
            cnx2.width=resizeWidth;
            cnx2.height=resizeHeight;
            mtx=cnx2.getContext('2d');
            mtx.drawImage(cnx1, 0, 0);

            cnx3=document.createElement('canvas');
            cnx3.width=resizeWidth;
            cnx3.height=resizeHeight;
            mtx=cnx3.getContext('2d');
            mtx.drawImage(cnx2, 0, 0);

            cnx4=document.createElement('canvas');
            cnx4.width=resizeWidth;
            cnx4.height=resizeHeight;
            mtx=cnx4.getContext('2d');
            mtx.drawImage(cnx3, 0, 0);


            var fc = document.getElementById('main').getContext('2d');
            var lc = document.getElementById('later').getContext('2d');
            fc.drawImage(cnx4, 0, 0);
            lc.drawImage(option, 0, 0, resizeWidth, resizeHeight);

        });
        console.log("fuck it is nt working", test);
    }
}
myApp.service('imageService', function ($http, $q, $timeout, $rootScope) {
    var NUM_LOBES = 3
    var lanczos = lanczosGenerator(NUM_LOBES)

    // resize via lanczos-sinc convolution
    this.resize = function (img, width, height) {
        var self = {}

        self.type = "image/png"
        self.quality = 1.0
        self.resultD = $q.defer()

        self.canvas = document.createElement('canvas')

        self.ctx = getContext(self.canvas)
        self.ctx.imageSmoothingEnabled = true
        self.ctx.mozImageSmoothingEnabled = true
        self.ctx.oImageSmoothingEnabled = true
        self.ctx.imageSmoothingEnabled = true

        if (img.naturalWidth <= width || img.naturalHeight <= height) {
            console.log("FAST resizing image", img.naturalWidth, img.naturalHeight, "=>", width, height)

            self.canvas.width = width
            self.canvas.height = height
            self.ctx.drawImage(img, 0, 0, width, height)
            resolveLanczos(self)
        } else {
            console.log("SLOW resizing image", img.naturalWidth, img.naturalHeight, "=>", width, height)

            self.canvas.width = img.naturalWidth
            self.canvas.height = img.naturalHeight
            self.ctx.drawImage(img, 0, 0, self.canvas.width, self.canvas.height)

            self.img = img
            self.src = self.ctx.getImageData(0, 0, self.canvas.width, self.canvas.height)
            self.dest = {
                width: width,
                height: height
            }
            self.dest.data = new Array(self.dest.width * self.dest.height * 4)

            self.ratio = img.naturalWidth / width
            self.rcpRatio = 2 / self.ratio
            self.range2 = Math.ceil(self.ratio * NUM_LOBES / 2)
            self.cacheLanc = {}
            self.center = {}
            self.icenter = {}

            $timeout(function () {
                applyLanczosColumn(self, 0)
            })
        }

        return self.resultD.promise
    }

    function applyLanczosColumn(self, u) {
        self.center.x = (u + 0.5) * self.ratio
        self.icenter.x = self.center.x | 0

        for (var v = 0; v < self.dest.height; v++) {
            self.center.y = (v + 0.5) * self.ratio
            self.icenter.y = self.center.y | 0

            var a, r, g, b
            a = r = g = b = 0

            var norm = 0
            var idx

            for (var i = self.icenter.x - self.range2; i <= self.icenter.x + self.range2; i++) {
                if (i < 0 || i >= self.src.width) continue
                var fX = (1000 * Math.abs(i - self.center.x)) | 0
                if (!self.cacheLanc[fX]) {
                    self.cacheLanc[fX] = {}
                }

                for (var j = self.icenter.y - self.range2; j <= self.icenter.y + self.range2; j++) {
                    if (j < 0 || j >= self.src.height) continue

                    var fY = (1000 * Math.abs(j - self.center.y)) | 0
                    if (self.cacheLanc[fX][fY] === undefined) {
                        self.cacheLanc[fX][fY] = lanczos(Math.sqrt(Math.pow(fX * self.rcpRatio, 2) + Math.pow(fY * self.rcpRatio, 2)) / 1000)
                    }

                    var weight = self.cacheLanc[fX][fY]
                    if (weight > 0) {
                        idx = (j * self.src.width + i) * 4
                        norm += weight

                        r += weight * self.src.data[idx + 0]
                        g += weight * self.src.data[idx + 1]
                        b += weight * self.src.data[idx + 2]
                        a += weight * self.src.data[idx + 3]
                    }
                }
            }

            idx = (v * self.dest.width + u) * 4
            self.dest.data[idx + 0] = r / norm
            self.dest.data[idx + 1] = g / norm
            self.dest.data[idx + 2] = b / norm
            self.dest.data[idx + 3] = a / norm
        }

        if (++u < self.dest.width) {
            if (u % 16 === 0) {
                $timeout(function () {
                    applyLanczosColumn(self, u)
                })
            } else {

                applyLanczosColumn(self, u)
            }
        } else {
            $timeout(function () {
                finalizeLanczos(self)
            })
        }
    }

    function finalizeLanczos(self) {
        self.canvas.width = self.dest.width
        self.canvas.height = self.dest.height
        //self.ctx.drawImage(self.img, 0, 0, self.dest.width, self.dest.height)
        self.src = self.ctx.getImageData(0, 0, self.dest.width, self.dest.height)
        var idx
        for (var i = 0; i < self.dest.width; i++) {
            for (var j = 0; j < self.dest.height; j++) {
                idx = (j * self.dest.width + i) * 4
                self.src.data[idx + 0] = self.dest.data[idx + 0]
                self.src.data[idx + 1] = self.dest.data[idx + 1]
                self.src.data[idx + 2] = self.dest.data[idx + 2]
                self.src.data[idx + 3] = self.dest.data[idx + 3]
            }
        }
        self.ctx.putImageData(self.src, 0, 0)
        resolveLanczos(self)
    }

    function resolveLanczos(self) {
        var result = new Image()

        result.onload = function () {
            $rootScope.$apply(self.resultD.resolve(result));

        }

        result.onerror = function (err) {
            self.resultD.reject(err)
        }

        result.src = self.canvas.toDataURL(self.type, self.quality)
    }

    // resize by stepping down
    this.resizeStep = function (img, width, height, quality) {
        quality = quality || 1.0

        var resultD = $q.defer()
        var canvas = document.createElement('canvas')
        var context = getContext(canvas)
        var type = "image/png"

        var cW = img.naturalWidth
        var cH = img.naturalHeight

        var dst = new Image()
        var tmp = null

        //resultD.resolve(img)
        //return resultD.promise

        function stepDown() {
            cW = Math.max(cW / 2, width) | 0
            cH = Math.max(cH / 2, height) | 0

            canvas.width = cW
            canvas.height = cH

            context.drawImage(tmp || img, 0, 0, cW, cH)

            dst.src = canvas.toDataURL(type, quality)

            if (cW <= width || cH <= height) {
                return resultD.resolve(dst)
            }

            if (!tmp) {
                tmp = new Image()
                tmp.onload = stepDown
            }

            tmp.src = dst.src
        }

        if (cW <= width || cH <= height || cW / 2 < width || cH / 2 < height) {
            canvas.width = width
            canvas.height = height
            context.drawImage(img, 0, 0, width, height)
            dst.src = canvas.toDataURL(type, quality)

            resultD.resolve(dst)
        } else {
            stepDown()
        }

        return resultD.promise
    }

    function getContext(canvas) {
        var context = canvas.getContext('2d')

        context.imageSmoothingEnabled = true
        context.mozImageSmoothingEnabled = true
        context.oImageSmoothingEnabled = true
        context.imageSmoothingEnabled = true

        return context
    }

    // returns a function that calculates lanczos weight
    function lanczosGenerator(lobes) {
        var recLobes = 1.0 / lobes

        return function (x) {
            if (x > lobes) return 0
            x *= Math.PI
            if (Math.abs(x) < 1e-16) return 1
            var xx = x * recLobes
            return Math.sin(x) * Math.sin(xx) / x / xx
        }
    }
});