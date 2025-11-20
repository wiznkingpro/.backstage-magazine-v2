function openSearchMenu() {
	const searchMenu = document.getElementById('search_menu');
	searchMenu.classList.add('active');
	document.body.style.overflow = 'hidden'; 
}

function closeSearchMenu() {
	const searchMenu = document.getElementById('search_menu');
	searchMenu.classList.remove('active');
	document.body.style.overflow = ''; //
}


document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') {
		closeSearchMenu();
	}
});

document.getElementById('search_menu').addEventListener('click', (e) => {
	if (e.target === document.getElementById('search_menu')) {
		closeSearchMenu();
	}
});

function openMainMenu() {
	const menu = document.getElementById('main_menu');
	menu.classList.add('active');
	document.body.style.overflow = 'hidden';
}

function closeMainMenu() {
	const menu = document.getElementById('main_menu');
	menu.classList.remove('active');
	document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') {
		closeMainMenu();
		closeSearchMenu();
	}
});

document.getElementById('main_menu').addEventListener('click', (e) => {
	if (e.target === document.getElementById('main_menu')) {
		closeMainMenu();
	}
});

document.querySelectorAll('.menu-item').forEach(item => {
	item.addEventListener('click', () => {
		closeMainMenu();
	});
});

const scrollToTopBtn = document.getElementById('scrollToTop');

window.addEventListener('scroll', () => {
	if (window.scrollY > 300) {
		scrollToTopBtn.classList.add('visible');
	} else {
		scrollToTopBtn.classList.remove('visible');
	}
});

scrollToTopBtn.addEventListener('click', () => {
	window.scrollTo({
		top: 0,
		behavior: 'smooth'
	});
});

