    document.addEventListener('DOMContentLoaded', () => {
        const nav = document.getElementById('nav');

        const width = 100;
        const height = 85;
        const centerX = width / 2;
        const centerY = height / 2;
        const outerRadius = 10  ;

        const n_air = 1.0;
        const n_glass = 1.5;
        const delta = 0.001;

        const surfaceFunction = (distanceFromSide) => {
            if (distanceFromSide >= outerRadius) return 0;
            const d_from_center = outerRadius - distanceFromSide; 
            const z = Math.sqrt(Math.max(0, outerRadius * outerRadius - d_from_center * d_from_center));
          
            return z;
        };


        const numSamples = Math.ceil(outerRadius);
        const displacementMagnitudes = [];
        const displacementAngles = [];

        for (let i = 0; i < numSamples; i++) {
            const distanceFromSide = i;
            const y1 = surfaceFunction(distanceFromSide - delta);
            const y2 = surfaceFunction(distanceFromSide + delta);
            const derivative = (y2 - y1) / (2 * delta);
            const normal_to_border = { x: derivative, y: 1 };
            const normal_length = Math.sqrt(normal_to_border.x * normal_to_border.x + normal_to_border.y * normal_to_border.y);
            if (normal_length > 0) {
                normal_to_border.x /= normal_length;
                normal_to_border.y /= normal_length;
            } else {
                normal_to_border.x = 0;
                normal_to_border.y = 1;
            }
            const surface_normal = { x: -derivative, y: 1 };
            const surface_normal_length = Math.sqrt(surface_normal.x * surface_normal.x + surface_normal.y * surface_normal.y);
            if (surface_normal_length > 0) {
                surface_normal.x /= surface_normal_length;
                surface_normal.y /= surface_normal_length;
            } else {
                surface_normal.x = 0;
                surface_normal.y = 1;
            }

            const cos_theta1 = surface_normal.y;
            if (cos_theta1 < 0) {
                surface_normal.x *= -1;
                surface_normal.y *= -1;
            }
            const abs_cos_theta1 = surface_normal.y;
            const sin_theta1 = Math.sqrt(Math.max(0, 1 - abs_cos_theta1 * abs_cos_theta1));
            const sin_theta2 = (n_air / n_glass) * sin_theta1;

            let magnitude = 0;
            let angle = 0;

            if (sin_theta2 <= 1) { 
    
                const cos_theta2 = Math.sqrt(Math.max(0, 1 - sin_theta2 * sin_theta2));
                const incident_ray = { x: 0, y: -1 }; 
                const n1_over_n2 = n_air / n_glass;
                const T_x = n1_over_n2 * incident_ray.x + (n1_over_n2 * abs_cos_theta1 - cos_theta2) * surface_normal.x;
                const T_y = n1_over_n2 * incident_ray.y + (n1_over_n2 * abs_cos_theta1 - cos_theta2) * surface_normal.y;
                magnitude = Math.sqrt(T_x * T_x + T_y * T_y); 
                angle = Math.atan2(-normal_to_border.x, normal_to_border.y); 
            } else {

                magnitude = 0;
                angle = 0;
            }

            displacementMagnitudes.push(magnitude);
            displacementAngles.push(angle);
        }

       
        const maximumDisplacement = Math.max(...displacementMagnitudes.map(Math.abs));
        if (maximumDisplacement === 0) {
            console.error("Maximum displacement is 0, cannot normalize.");
        }

        const normalizedDisplacements = displacementMagnitudes.map((mag, i) => ({
            magnitude: mag / maximumDisplacement,
            angle: displacementAngles[i]
        }));

       
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
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


        const dataUrl = canvas.toDataURL('image/png');


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
   
        feDisplace.setAttribute("scale", maximumDisplacement * -20);
        feDisplace.setAttribute("xChannelSelector", "R");
        feDisplace.setAttribute("yChannelSelector", "G");

        filter.appendChild(feImage);
        filter.appendChild(feDisplace);
        svg.appendChild(filter);

       
        const oldSvg = document.getElementById('liquid-glass-svg');
        if (oldSvg) {
            oldSvg.remove();
        }
        document.body.appendChild(svg);

        nav.style.backdropFilter = 'url(#liquid-glass-filter)';








     
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
