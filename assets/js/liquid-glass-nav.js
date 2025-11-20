    document.addEventListener('DOMContentLoaded', () => {
        const nav = document.getElementById('nav');

        // --- Параметры ---
        // Используем размеры, соответствующие nav или его ожидаемому размеру
        // Для примера, пусть будет 100x85, как в оригинальном коде, но это может быть адаптивно
        const width = 100;
        const height = 85;
        const centerX = width / 2;
        const centerY = height / 2;
        const outerRadius = 10  ; // Уменьшаем для более реалистичной кривизны

        // --- Физические параметры ---
        const n_air = 1.0;
        const n_glass = 1.5; // Стандартный показатель преломления для "стекла"
        const delta = 0.001; // Для численной производной

        // --- 1. Функция поверхности (Simple circular arc) ---
        // В статье описывается, что f(distanceFromSide) возвращает высоту.
        // Для простой дуги (half-circle profile) высота z на расстоянии d от края рассчитывается как:
        // z = sqrt(r^2 - (r - d)^2), где r - радиус дуги.
        // При d = 0 (на краю), z = 0.
        // При d = r (в центре), z = r.
        const surfaceFunction = (distanceFromSide) => {
            if (distanceFromSide >= outerRadius) return 0; // За пределами радиуса высота 0
            const d_from_center = outerRadius - distanceFromSide; // d - расстояние от края к центру
            const z = Math.sqrt(Math.max(0, outerRadius * outerRadius - d_from_center * d_from_center));
            // Возвращаем нормализованную высоту, чтобы результат был в пределах [0, 1]
            // Это не обязательно для вычисления нормали, но полезно для масштабирования.
            // В данном случае, нормализация не требуется для самой функции высоты, но важно понимать масштаб.
            // Возвращаем просто z.
            return z;
        };

        // --- 2. Предварительный расчёт величины и направления смещения по радиусу ---
        // В статье говорится, что смещение симметрично, и его можно рассчитать для половины объекта (например, 127 сэмплов).
        // numSamples = ceil(outerRadius) - это количество точек от края до центра (или от центра до края, в зависимости от интерпретации).
        // Для круга, если outerRadius = 127, то numSamples = 127.
        const numSamples = Math.ceil(outerRadius);
        const displacementMagnitudes = [];
        const displacementAngles = [];

        for (let i = 0; i < numSamples; i++) {
            const distanceFromSide = i;

            // Вычисляем нормаль к поверхности в точке distanceFromSide
            // Нормаль - это вектор, перпендикулярный касательной к кривой в этой точке.
            // Для кривой z = f(x), где x - расстояние от края, нормаль к "границе" в 2D (x, z) определяется как (-f'(x), 1), нормализованный.
            const y1 = surfaceFunction(distanceFromSide - delta);
            const y2 = surfaceFunction(distanceFromSide + delta);
            const derivative = (y2 - y1) / (2 * delta); // Это dz/dx

            // Вектор нормали к поверхности (не к краю, а к самой поверхности)
            // В 2D, если поверхность задана как z = f(x), то нормальный вектор к этой поверхности в точке (x, f(x)) есть (-f'(x), 1)
            // Но для "границы" объекта, как описано в статье, нормаль к границе (в 2D проекции) - это (derivative, 1), если граница вертикальная.
            // Для круга, нормаль к краю (касательная к дуге) - это (dz/dx, 1), нормализованная.
            // Нормаль к краю (border normal)
            const normal_to_border = { x: derivative, y: 1 };
            const normal_length = Math.sqrt(normal_to_border.x * normal_to_border.x + normal_to_border.y * normal_to_border.y);
            if (normal_length > 0) {
                normal_to_border.x /= normal_length;
                normal_to_border.y /= normal_length;
            } else {
                // Плоская поверхность
                normal_to_border.x = 0;
                normal_to_border.y = 1;
            }

            // Угол нормали к краю
            // const normal_angle = Math.atan2(normal_to_border.y, normal_to_border.x);
            // Вектор смещения должен быть ортогонален нормали к краю (то есть параллелен касательной к краю).
            // Касательный вектор к краю: (t_x, t_y) = (-normal_to_border.y, normal_to_border.x) или (normal_to_border.y, -normal_to_border.x)
            // Выберем (normal_to_border.y, -normal_to_border.x) для направления смещения "вовне".
            // Это и будет направление смещения.
            // angle = Math.atan2(-normal_to_border.x, normal_to_border.y);

            // Вычисляем угол падения и преломления по закону Снеллиуса.
            // Предполагаем, что луч падает перпендикулярно фону (вниз по Y в системе координат canvas).
            // Угол падения theta1 отсчитывается от нормали к поверхности (а не к краю!).
            // Нормаль к *поверхности* (а не к краю) - это (-derivative, 1), нормализованная.
            const surface_normal = { x: -derivative, y: 1 };
            const surface_normal_length = Math.sqrt(surface_normal.x * surface_normal.x + surface_normal.y * surface_normal.y);
            if (surface_normal_length > 0) {
                surface_normal.x /= surface_normal_length;
                surface_normal.y /= surface_normal_length;
            } else {
                surface_normal.x = 0;
                surface_normal.y = 1;
            }

            // Угол падения: угол между падающим лучом (0, -1) и нормалью к поверхности (surface_normal)
            // cos(theta1) = dot_product(-incoming_ray, surface_normal) = dot_product((0, 1), surface_normal) = surface_normal.y
            // (Падающий луч (0, -1), нормаль (n_x, n_y), cos = (0*-1 + 1*n_y) = n_y, если нормаль нормализована)
            const cos_theta1 = surface_normal.y;
            // Проверяем, смотрит ли нормаль "внутрь" (cos_theta1 < 0), и инвертируем, если да.
            if (cos_theta1 < 0) {
                surface_normal.x *= -1;
                surface_normal.y *= -1;
                // cos_theta1 *= -1; // Не нужно, т.к. он будет пересчитан
            }
            const abs_cos_theta1 = surface_normal.y; // Теперь >= 0
            const sin_theta1 = Math.sqrt(Math.max(0, 1 - abs_cos_theta1 * abs_cos_theta1));
            const sin_theta2 = (n_air / n_glass) * sin_theta1;

            let magnitude = 0;
            let angle = 0;

            if (sin_theta2 <= 1) { // Нет полного внутреннего отражения
                // const theta1 = Math.acos(abs_cos_theta1);
                // const theta2 = Math.asin(sin_theta2);
                // const deviation_angle = theta1 - theta2;
                // magnitude = Math.tan(deviation_angle); // Это приближение, как в оригинальном коде

                // Более точное вычисление смещения вектора преломленного луча
                // Падающий луч: (0, -1)
                // Нормаль к поверхности: (n_surf_x, n_surf_y)
                // Преломленный луч (вектор): можно вычислить через закон Снеллиуса в векторной форме
                // T = n1/n2 * I + (n1/n2 * cos(theta1) - cos(theta2)) * N
                // где I - падающий луч (нормализованный), N - нормаль к поверхности (нормализованная), T - преломленный луч (нормализованный)
                // cos(theta2) = sqrt(1 - sin_theta2^2)
                const cos_theta2 = Math.sqrt(Math.max(0, 1 - sin_theta2 * sin_theta2));
                const incident_ray = { x: 0, y: -1 }; // Нормализованный падающий луч
                const n1_over_n2 = n_air / n_glass;
                const T_x = n1_over_n2 * incident_ray.x + (n1_over_n2 * abs_cos_theta1 - cos_theta2) * surface_normal.x;
                const T_y = n1_over_n2 * incident_ray.y + (n1_over_n2 * abs_cos_theta1 - cos_theta2) * surface_normal.y;
                // Вектор смещения - это разница между преломленным и падающим лучом (или сам преломленный луч, масштабированный)
                // magnitude = sqrt(T_x^2 + T_y^2);
                // angle = atan2(T_y, T_x);
                // Это даст направление и величину смещения в системе координат поверхности.
                // magnitude = Math.sqrt(T_x * T_x + T_y * T_y);
                // angle = Math.atan2(T_y, T_x);

                // Однако, в SVG feDisplacementMap, смещение применяется в системе координат изображения.
                // В статье говорится, что смещение ортогонально границе.
                // Направление смещения - ортогонально нормали к *границе* объекта, а не к поверхности.
                // Нормаль к границе: (normal_to_border.x, normal_to_border.y)
                // Ортогональный вектор (касательная к границе): (normal_to_border.y, -normal_to_border.x)
                // magnitude = tan(deviation_angle) или magnitude = sqrt(T_x^2 + T_y^2) или используем sin_theta2
                // magnitude = sin_theta2 * scale_factor; // Простое приближение
                magnitude = Math.sqrt(T_x * T_x + T_y * T_y); // Используем вектор преломления
                angle = Math.atan2(-normal_to_border.x, normal_to_border.y); // Ортогонально нормали к границе
            } else {
                // Полное внутреннее отражение, смещение = 0
                magnitude = 0;
                angle = 0;
            }

            displacementMagnitudes.push(magnitude);
            displacementAngles.push(angle);
        }

        // --- 3. Нормализация векторов ---
        const maximumDisplacement = Math.max(...displacementMagnitudes.map(Math.abs));
        if (maximumDisplacement === 0) {
            console.error("Maximum displacement is 0, cannot normalize.");
        }

        const normalizedDisplacements = displacementMagnitudes.map((mag, i) => ({
            magnitude: mag / maximumDisplacement,
            angle: displacementAngles[i]
        }));

        // --- 4. Генерация полной карты смещения ---
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                // Для круглого эффекта: расстояние от центра
                const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
                // Для прямоугольного эффекта с "безелем": расстояние до ближайшего края
                // const distanceFromEdgeX = Math.max(0, Math.abs(dx) - (width/2 - outerRadius));
                // const distanceFromEdgeY = Math.max(0, Math.abs(dy) - (height/2 - outerRadius));
                // const distanceFromBorder = Math.min(distanceFromEdgeX, distanceFromEdgeY);
                // Используем круглую модель, как в оригинальном коде, но с новыми вычислениями
                const distanceFromBorder = Math.max(0, outerRadius - distanceFromCenter);

                let r = 128;
                let g = 128;
                let b = 128;
                let a = 255;

                if (distanceFromCenter <= outerRadius) {
                    const index = Math.max(0, Math.min(Math.floor(distanceFromBorder), normalizedDisplacements.length - 1));

                    const { magnitude, angle: local_angle } = normalizedDisplacements[index];

                    const x_disp = Math.cos(local_angle) * magnitude;
                    const y_disp = Math.sin(local_angle) * magnitude;

                    r = 128 + x_disp * 127;
                    g = 128 + y_disp * 127;

                    r = Math.max(0, Math.min(255, r));
                    g = Math.max(0, Math.min(255, g));
                }

                const index = (y * width + x) * 4;
                imageData.data[index + 0] = r;
                imageData.data[index + 1] = g;
                imageData.data[index + 2] = b;
                imageData.data[index + 3] = a;
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // --- 5. Преобразуем canvas в Data URL ---
        const dataUrl = canvas.toDataURL('image/png');

        // --- 6. Создаём SVG-фильтр динамически ---
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "0");
        svg.setAttribute("height", "0");
        svg.setAttribute("style", "position: absolute; z-index: -1;");

        const filter = document.createElementNS(svgNS, "filter");
        filter.setAttribute("id", "liquid-glass-filter");
        filter.setAttribute("x", "0");
        filter.setAttribute("y", "0");
        filter.setAttribute("width", "100%");
        filter.setAttribute("height", "100%");

        const feImage = document.createElementNS(svgNS, "feImage");
        feImage.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataUrl);
        feImage.setAttributeNS(null, "href", dataUrl);
        feImage.setAttribute("x", "0");
        feImage.setAttribute("y", "0");
        feImage.setAttribute("width", width);
        feImage.setAttribute("height", height);
        feImage.setAttribute("result", "displacement_map");

        const feDisplace = document.createElementNS(svgNS, "feDisplacementMap");
        feDisplace.setAttribute("in", "SourceGraphic");
        feDisplace.setAttribute("in2", "displacement_map");
        // Масштабируем смещение. maximumDisplacement - это нормализованная величина.
        // Множитель 20 может быть подобран эмпирически для желаемого эффекта.
        feDisplace.setAttribute("scale", maximumDisplacement * -20);
        feDisplace.setAttribute("xChannelSelector", "R");
        feDisplace.setAttribute("yChannelSelector", "G");

        filter.appendChild(feImage);
        filter.appendChild(feDisplace);
        svg.appendChild(filter);

        // Удаляем старый SVG (если он был), и добавляем новый
        const oldSvg = document.getElementById('liquid-glass-svg');
        if (oldSvg) {
            oldSvg.remove();
        }
        document.body.appendChild(svg);

        // --- 7. Применяем фильтр к nav ---
        // Важно: backdrop-filter может не работать в браузерах, кроме Chrome
        nav.style.backdropFilter = 'url(#liquid-glass-filter)';








        // --- Код для изменения цвета текста (остается без изменений) ---
        const textElements = [
            document.querySelector('#nav .logo'),
            document.querySelector('#nav .logo-slogan'),
            ...document.querySelectorAll('#nav button')
        ].filter(el => el);

        const canvasContrast = document.createElement('canvas');
        const ctxContrast = canvasContrast.getContext('2d');

        const getLuminance = (r, g, b) => {
            return 0.299 * r + 0.587 * g + 0.114 * b;
        };

        const updateElementColor = (element) => {
            if (!element) return;

            const rect = element.getBoundingClientRect();
            const navRect = nav.getBoundingClientRect();

            canvasContrast.width = navRect.width;
            canvasContrast.height = navRect.height;

            const bodyRect = document.body.getBoundingClientRect();
            const x = rect.left - bodyRect.left;
            const y = rect.top - bodyRect.top;

            canvasContrast.width = document.body.scrollWidth;
            canvasContrast.height = document.body.scrollHeight;

            let bgColor = 'white';
            const scrollY = window.scrollY;
            const navTop = navRect.top + scrollY;
            const navCenterY = navTop + navRect.height / 2;

            const contentElement = document.querySelector('.content');
            const footerElement = document.querySelector('footer');
            const backgroundNavElement = document.querySelector('.background_nav');

            if (backgroundNavElement) {
                const bgRect = backgroundNavElement.getBoundingClientRect();
                const bgTop = bgRect.top + scrollY;
                const bgBottom = bgTop + bgRect.height;

                if (navCenterY >= bgTop && navCenterY <= bgBottom) {
                    bgColor = window.getComputedStyle(backgroundNavElement).backgroundColor;
                }
            }

            if ((!bgColor || bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') && contentElement) {
                const contentRect = contentElement.getBoundingClientRect();
                const contentTop = contentRect.top + scrollY;
                const contentBottom = contentTop + contentRect.height;

                if (navCenterY >= contentTop && navCenterY <= contentBottom) {
                    bgColor = window.getComputedStyle(contentElement).backgroundColor;
                }
            }

            if ((!bgColor || bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') && footerElement) {
                const footerRect = footerElement.getBoundingClientRect();
                const footerTop = footerRect.top + scrollY;
                const footerBottom = footerTop + footerRect.height;

                if (navCenterY >= footerTop && navCenterY <= footerBottom) {
                    bgColor = window.getComputedStyle(footerElement).backgroundColor;
                }
            }

            let r = 255, g = 255, b = 255;
            if (bgColor && bgColor.startsWith('rgb')) {
                const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
                if (match) {
                    r = parseInt(match[1]);
                    g = parseInt(match[2]);
                    b = parseInt(match[3]);
                }
            } else if (bgColor && bgColor.startsWith('#')) {
                const hex = bgColor.substring(1);
                const bigint = parseInt(hex, 16);
                r = (bigint >> 16) & 255;
                g = (bigint >> 8) & 255;
                b = bigint & 255;
            }

            const luminance = getLuminance(r, g, b);

            element.classList.remove('contrast-dark', 'contrast-light');
            if (luminance > 128) {
                element.classList.add('contrast-dark');
            } else {
                element.classList.add('contrast-light');
            }
        };

        const updateAllColors = () => {
            textElements.forEach(updateElementColor);
        };

        updateAllColors();

        let ticking = false;
        const onScrollResize = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    updateAllColors();
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', onScrollResize, { passive: true });
        window.addEventListener('resize', onScrollResize, { passive: true });
    });