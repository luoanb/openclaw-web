<script>
	import './app.css';
	import Router from 'svelte-spa-router';
	import Home from './routes/Home.svelte';
	import About from './routes/About.svelte';
	import Demo from './routes/Demo.svelte';

	const routes = {
		'/': Home,
		'/about': About,
		'/demo': Demo,
	};
</script>

<Router {routes} />
