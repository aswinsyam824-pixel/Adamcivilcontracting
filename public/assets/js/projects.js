/* Projects listing filters and query-driven project case study content. */
(function () {
  const projectData = [
    {
      id: "business-bay-office",
      title: "Business Bay Corporate Office Fit-Out",
      category: "fitout",
      categoryLabel: "Fitout",
      type: "Office fitout",
      location: "Business Bay, Dubai",
      year: "2026",
      summary: "Complete fitout of an open-plan corporate office, including partitions, ceilings, joinery and MEP works.",
      description: "The client needed a modern open-plan workspace with meeting rooms, a reception area and a pantry, delivered with minimal disruption to the building's other tenants.",
      delivery: "Our team handled space planning coordination, authority approvals, interior works and the MEP services behind them, handing over a ready-to-use office.",
      scope: ["Space planning coordination", "Gypsum and glass partitions", "Suspended ceilings", "Joinery and reception counter", "HVAC and electrical works", "Authority approvals"],
      images: ["focus-fit-out.jpg", "approach-2.jpg", "approach-1.jpg", "approach-4.jpg", "services/civil-construction-infrastructure-1.jpg"],
      imageAlt: ["Corporate office fitout project view", "Fitout team reviewing interior construction drawings", "Office space planning and project coordination", "Construction team coordinating project delivery", "Construction work at a project site"]
    },
    {
      id: "deira-tower-hvac",
      title: "Deira Commercial Tower HVAC Upgrade",
      category: "mep",
      categoryLabel: "MEP",
      type: "HVAC installation",
      location: "Deira, Dubai",
      year: "2025",
      summary: "HVAC upgrade works coordinated around the commercial tower's operating requirements.",
      description: "This sample case study covers an HVAC upgrade in an occupied commercial tower, with a focus on coordinated installation and planned work areas.",
      delivery: "The work included site coordination, HVAC installation sequencing, testing and handover planning in line with the agreed project scope.",
      scope: ["HVAC system review", "Ductwork installation", "Equipment coordination", "Work area planning", "System testing", "Handover documentation"],
      images: ["services/mechanical-electrical-cooling-1.jpg", "services/mechanical-electrical-cooling-2.jpg", "services/mechanical-electrical-cooling-3.jpg", "services/mechanical-electrical-cooling-4.jpg", "approach-2.jpg"],
      imageAlt: ["Commercial project site overview", "HVAC ductwork installation", "Mechanical services coordination", "Building services project installation", "Project team reviewing drawings"]
    },
    {
      id: "al-barsha-amc",
      title: "Al Barsha Commercial Building AMC",
      category: "amc",
      categoryLabel: "AMC",
      type: "Annual maintenance contract",
      location: "Al Barsha, Dubai",
      year: "2026",
      summary: "Planned building maintenance and reactive support coordinated under an annual service arrangement.",
      description: "This sample case study describes facilities support for a commercial building, designed around routine care of agreed assets and responsive follow-up.",
      delivery: "Maintenance visits, service coordination and reporting are planned against the confirmed asset list, operating hours and contract scope.",
      scope: ["Planned preventive maintenance", "HVAC inspections", "Reactive maintenance coordination", "Service request tracking", "Visit reporting", "Annual service planning"],
      images: ["focus-amc.jpg", "services/mechanical-electrical-cooling-1.jpg", "services/mechanical-electrical-cooling-2.jpg", "services/cleaning-insulation-1.jpg", "approach-3.jpg"],
      imageAlt: ["Technicians maintaining air-conditioning equipment", "Building HVAC systems", "Mechanical services maintenance", "Building cleaning and maintenance", "Facilities support team at work"]
    },
    {
      id: "al-nahda-fire-gas",
      title: "Al Nahda Residential Fire and Gas Upgrade",
      category: "mep",
      categoryLabel: "MEP",
      type: "Fire and gas systems",
      location: "Al Nahda, Sharjah",
      year: "2025",
      summary: "Fire protection and gas system upgrades coordinated for a residential building.",
      description: "This sample project covers coordinated fire and gas works in a residential building, with installation activity planned around access and building operations.",
      delivery: "The project approach includes system coordination, installation sequencing, required testing and completion documentation, subject to the agreed scope.",
      scope: ["Fire system review", "Firefighting equipment works", "Gas line coordination", "Building access planning", "Testing coordination", "Completion records"],
      images: ["services/fire-safety-gas-piping-1.jpg", "services/fire-safety-gas-piping-2.jpg", "services/fire-safety-gas-piping-3.jpg", "services/mechanical-electrical-cooling-1.jpg", "approach-2.jpg"],
      imageAlt: ["Fire hose cabinet inspection", "Fire safety system installation", "Gas and piping services", "Mechanical services coordination", "Project team reviewing site plans"]
    },
    {
      id: "jvc-residential-structure",
      title: "JVC Residential Building Structure",
      category: "civil",
      categoryLabel: "Civil",
      type: "Civil construction",
      location: "Jumeirah Village Circle, Dubai",
      year: "2026",
      summary: "Concrete structure and blockwork activities coordinated across a residential construction site.",
      description: "This sample case study follows structural construction activities for a residential building, with site work coordinated around sequencing and safety requirements.",
      delivery: "The project delivery sequence covers structural works, blockwork interfaces, site coordination and progress tracking through agreed milestones.",
      scope: ["Site coordination", "Concrete structural works", "Blockwork interfaces", "Construction sequencing", "Progress tracking", "Handover coordination"],
      images: ["services/civil-construction-infrastructure-1.jpg", "services/civil-construction-infrastructure-2.jpg", "services/civil-construction-infrastructure-3.jpg", "services/civil-construction-infrastructure-4.jpg", "services/civil-construction-infrastructure.jpg"],
      imageAlt: ["Residential building structure under construction", "Civil construction worksite", "Structural works in progress", "Construction project team", "Building construction overview"]
    },
    {
      id: "khalifa-city-landscape",
      title: "Khalifa City Villa Landscape and Pool",
      category: "landscaping",
      categoryLabel: "Landscaping",
      type: "Landscape and pool works",
      location: "Khalifa City, Abu Dhabi",
      year: "2023",
      summary: "Villa landscaping and pool works planned to create a coordinated outdoor living space.",
      description: "This sample case study describes coordinated landscape and pool works for a villa, including the surrounding planting, paths and outdoor areas.",
      delivery: "The team coordinates site preparation, landscaping, irrigation interfaces and pool-related works to align with the agreed design and programme.",
      scope: ["Landscape site preparation", "Planting and soft landscaping", "Hardscape coordination", "Irrigation interfaces", "Pool works coordination", "Completion review"],
      images: ["services/landscaping-pools-1.jpg", "services/landscaping-pools-2.jpg", "services/landscaping-pools.jpg", "approach-3.jpg", "approach-4.jpg"],
      imageAlt: ["Villa landscape installation", "Pool maintenance and outdoor works", "Landscaping project site", "Project planning and materials", "Outdoor project completion"]
    }
  ];

  const projects = document.querySelectorAll(".projects-grid");
  if (projects.length) {
    const cards = [...document.querySelectorAll(".project-card")];
    const filters = [...document.querySelectorAll("[data-filter]")];
    const count = document.querySelector("[data-project-count]");
    filters.forEach(button => button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      filters.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      const visibleCount = cards.reduce((total, card) => {
        const visible = filter === "all" || card.dataset.category === filter;
        card.hidden = !visible;
        return total + Number(visible);
      }, 0);
      if (count) count.textContent = String(visibleCount);
    }));
  }

  const title = document.querySelector("[data-project-title]");
  if (!title) return;
  const requestedId = new URLSearchParams(location.search).get("project");
  const projectIndex = Math.max(0, projectData.findIndex(project => project.id === requestedId));
  const project = projectData[projectIndex];
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };
  const hero = document.querySelector("[data-project-hero]");
  if (hero) {
    hero.src = `../../assets/img/photos/${project.images[0]}`;
    hero.alt = project.imageAlt[0];
  }
  setText("[data-project-title]", project.title);
  setText("[data-project-breadcrumb]", project.title);
  setText("[data-project-type]", `${project.categoryLabel} · ${project.type}`);
  setText("[data-project-summary]", project.summary);
  setText("[data-project-meta-type]", project.type);
  setText("[data-project-location]", project.location);
  setText("[data-project-year]", project.year);
  setText("[data-project-description]", project.description);
  setText("[data-project-delivery]", project.delivery);
  document.title = `${project.title} | Adam Civil Contracting LLC`;

  const scope = document.querySelector("[data-project-scope]");
  if (scope) {
    scope.replaceChildren(...project.scope.map(item => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    }));
  }
  const gallery = document.querySelector("[data-project-gallery]");
  if (gallery) {
    gallery.replaceChildren(...project.images.map((image, index) => {
      const img = document.createElement("img");
      img.src = `../../assets/img/photos/${image}`;
      img.alt = project.imageAlt[index];
      img.loading = "lazy";
      img.decoding = "async";
      if (index === 0) img.className = "project-gallery__featured";
      return img;
    }));
    setText("[data-gallery-count]", String(project.images.length));
  }
  const previous = projectData[(projectIndex - 1 + projectData.length) % projectData.length];
  const next = projectData[(projectIndex + 1) % projectData.length];
  const prevLink = document.querySelector("[data-project-prev]");
  const nextLink = document.querySelector("[data-project-next]");
  if (prevLink) prevLink.href = `?project=${previous.id}`;
  if (nextLink) nextLink.href = `?project=${next.id}`;
  setText("[data-project-prev-title]", previous.title);
  setText("[data-project-next-title]", next.title);
})();
