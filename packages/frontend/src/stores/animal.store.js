import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import animalService from '@/services/animal.service';

export const useAnimalStore = defineStore('animal', () => {
  // ==================== STATE ====================

  // Animal Types
  const animalTypes = ref([]);
  const animalTypeCategories = ref([]);

  // Breeds
  const breeds = ref([]);

  // Housing
  const housing = ref([]);
  const housingTypes = ref([]);

  // Individual Animals
  const animals = ref([]);
  const currentAnimal = ref(null);
  const animalStatistics = ref(null);

  // Animal Groups
  const groups = ref([]);
  const currentGroup = ref(null);
  const groupStatistics = ref(null);

  // Deaths
  const deaths = ref([]);
  const deathStatistics = ref(null);

  // Care Plans
  const carePlans = ref([]);
  const currentCarePlan = ref(null);

  // Care Schedules
  const careSchedules = ref([]);
  const scheduledTasks = ref([]);
  const careAlerts = ref(null);

  // Loading states
  const loading = ref(false);
  const saving = ref(false);

  // Error state
  const error = ref(null);

  // Pagination
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  // ==================== GETTERS ====================

  const activeAnimals = computed(() =>
    animals.value.filter(a => a.status === 'active')
  );

  const activeGroups = computed(() =>
    groups.value.filter(g => g.status === 'active')
  );

  const totalActiveAnimals = computed(() =>
    animalStatistics.value?.active_count || 0
  );

  const totalActiveGroupAnimals = computed(() =>
    groupStatistics.value?.total_active_animals || 0
  );

  const breedsByType = computed(() => (typeId) =>
    breeds.value.filter(b => b.animal_type_id === typeId)
  );

  const activeHousing = computed(() =>
    housing.value.filter(h => h.is_active)
  );

  // ==================== ACTIONS ====================

  // Error handling helper
  const handleError = (err) => {
    error.value = err.response?.data?.message || err.message || 'An error occurred';
    console.error('Animal store error:', error.value);
  };

  // Clear error
  const clearError = () => {
    error.value = null;
  };

  // ---- Animal Types ----

  const fetchAnimalTypes = async () => {
    loading.value = true;
    clearError();
    try {
      const response = await animalService.getAnimalTypes();
      animalTypes.value = response.data.data || [];
    } catch (err) {
      handleError(err);
    } finally {
      loading.value = false;
    }
  };

  const fetchAnimalTypeCategories = async () => {
    try {
      const response = await animalService.getAnimalTypeCategories();
      animalTypeCategories.value = response.data.data || [];
    } catch (err) {
      handleError(err);
    }
  };

  const createAnimalType = async (data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.createAnimalType(data);
      animalTypes.value.push(response.data.data);
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const updateAnimalType = async (id, data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.updateAnimalType(id, data);
      const index = animalTypes.value.findIndex(t => t.id === id);
      if (index !== -1) {
        animalTypes.value[index] = response.data.data;
      }
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const deleteAnimalType = async (id) => {
    saving.value = true;
    clearError();
    try {
      await animalService.deleteAnimalType(id);
      animalTypes.value = animalTypes.value.filter(t => t.id !== id);
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  // ---- Breeds ----

  const fetchBreeds = async (params = {}) => {
    loading.value = true;
    clearError();
    try {
      const response = await animalService.getBreeds(params);
      breeds.value = response.data.data || [];
    } catch (err) {
      handleError(err);
    } finally {
      loading.value = false;
    }
  };

  const createBreed = async (data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.createBreed(data);
      breeds.value.push(response.data.data);
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const updateBreed = async (id, data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.updateBreed(id, data);
      const index = breeds.value.findIndex(b => b.id === id);
      if (index !== -1) {
        breeds.value[index] = response.data.data;
      }
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const deleteBreed = async (id) => {
    saving.value = true;
    clearError();
    try {
      await animalService.deleteBreed(id);
      breeds.value = breeds.value.filter(b => b.id !== id);
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  // ---- Housing ----

  const fetchHousing = async (params = {}) => {
    loading.value = true;
    clearError();
    try {
      const response = await animalService.getHousing(params);
      housing.value = response.data.data || [];
    } catch (err) {
      handleError(err);
    } finally {
      loading.value = false;
    }
  };

  const fetchHousingTypes = async () => {
    try {
      const response = await animalService.getHousingTypes();
      housingTypes.value = response.data.data || [];
    } catch (err) {
      handleError(err);
    }
  };

  const createHousing = async (data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.createHousing(data);
      housing.value.push(response.data.data);
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const updateHousing = async (id, data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.updateHousing(id, data);
      const index = housing.value.findIndex(h => h.id === id);
      if (index !== -1) {
        housing.value[index] = response.data.data;
      }
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const deleteHousing = async (id) => {
    saving.value = true;
    clearError();
    try {
      await animalService.deleteHousing(id);
      housing.value = housing.value.filter(h => h.id !== id);
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  // ---- Individual Animals ----

  const fetchAnimals = async (params = {}) => {
    loading.value = true;
    clearError();
    try {
      const response = await animalService.getAnimals(params);
      animals.value = response.data.data || [];
      if (response.data.pagination) {
        pagination.value = response.data.pagination;
      }
    } catch (err) {
      handleError(err);
    } finally {
      loading.value = false;
    }
  };

  const fetchAnimalById = async (id) => {
    loading.value = true;
    clearError();
    try {
      const response = await animalService.getAnimalById(id);
      currentAnimal.value = response.data.data;
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchAnimalStatistics = async () => {
    try {
      const response = await animalService.getAnimalStatistics();
      animalStatistics.value = response.data.data;
    } catch (err) {
      handleError(err);
    }
  };

  const createAnimal = async (data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.createAnimal(data);
      animals.value.unshift(response.data.data);
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const updateAnimal = async (id, data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.updateAnimal(id, data);
      const index = animals.value.findIndex(a => a.id === id);
      if (index !== -1) {
        animals.value[index] = response.data.data;
      }
      if (currentAnimal.value?.id === id) {
        currentAnimal.value = response.data.data;
      }
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const recordAnimalSale = async (id, data = {}) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.recordAnimalSale(id, data);
      const index = animals.value.findIndex(a => a.id === id);
      if (index !== -1) {
        animals.value[index] = response.data.data;
      }
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const recordAnimalDeath = async (animalId, data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.recordAnimalDeath(animalId, data);
      // Refresh the animal list to reflect the status change
      await fetchAnimals();
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const deleteAnimal = async (id) => {
    saving.value = true;
    clearError();
    try {
      await animalService.deleteAnimal(id);
      animals.value = animals.value.filter(a => a.id !== id);
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  // ---- Animal Groups ----

  const fetchGroups = async (params = {}) => {
    loading.value = true;
    clearError();
    try {
      const response = await animalService.getGroups(params);
      groups.value = response.data.data || [];
      if (response.data.pagination) {
        pagination.value = response.data.pagination;
      }
    } catch (err) {
      handleError(err);
    } finally {
      loading.value = false;
    }
  };

  const fetchGroupById = async (id) => {
    loading.value = true;
    clearError();
    try {
      const response = await animalService.getGroupById(id);
      currentGroup.value = response.data.data;
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchGroupStatistics = async () => {
    try {
      const response = await animalService.getGroupStatistics();
      groupStatistics.value = response.data.data;
    } catch (err) {
      handleError(err);
    }
  };

  const createGroup = async (data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.createGroup(data);
      groups.value.unshift(response.data.data);
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const updateGroup = async (id, data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.updateGroup(id, data);
      const index = groups.value.findIndex(g => g.id === id);
      if (index !== -1) {
        groups.value[index] = response.data.data;
      }
      if (currentGroup.value?.id === id) {
        currentGroup.value = response.data.data;
      }
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const recordGroupAddition = async (groupId, data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.recordGroupAddition(groupId, data);
      // Refresh to get updated quantity
      await fetchGroups();
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const recordGroupRemoval = async (groupId, data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.recordGroupRemoval(groupId, data);
      // Refresh to get updated quantity
      await fetchGroups();
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const recordGroupDeaths = async (groupId, data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.recordGroupDeaths(groupId, data);
      // Refresh to get updated quantity
      await fetchGroups();
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const closeGroup = async (id) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.closeGroup(id);
      const index = groups.value.findIndex(g => g.id === id);
      if (index !== -1) {
        groups.value[index] = response.data.data;
      }
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const deleteGroup = async (id) => {
    saving.value = true;
    clearError();
    try {
      await animalService.deleteGroup(id);
      groups.value = groups.value.filter(g => g.id !== id);
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  // ---- Deaths ----

  const fetchDeaths = async (params = {}) => {
    loading.value = true;
    clearError();
    try {
      const response = await animalService.getDeaths(params);
      deaths.value = response.data.data || [];
    } catch (err) {
      handleError(err);
    } finally {
      loading.value = false;
    }
  };

  const fetchDeathStatistics = async (params = {}) => {
    try {
      const response = await animalService.getDeathStatistics(params);
      deathStatistics.value = response.data.data;
    } catch (err) {
      handleError(err);
    }
  };

  // ---- Care Plans ----

  const fetchCarePlans = async (params = {}) => {
    loading.value = true;
    clearError();
    try {
      const response = await animalService.getCarePlans(params);
      carePlans.value = response.data.data || [];
    } catch (err) {
      handleError(err);
    } finally {
      loading.value = false;
    }
  };

  const fetchCarePlanById = async (id) => {
    loading.value = true;
    clearError();
    try {
      const response = await animalService.getCarePlanById(id);
      currentCarePlan.value = response.data.data;
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createCarePlan = async (data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.createCarePlan(data);
      carePlans.value.unshift(response.data.data);
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const updateCarePlan = async (id, data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.updateCarePlan(id, data);
      const index = carePlans.value.findIndex(p => p.id === id);
      if (index !== -1) {
        carePlans.value[index] = response.data.data;
      }
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const cloneCarePlan = async (id, data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.cloneCarePlan(id, data);
      carePlans.value.unshift(response.data.data);
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const deleteCarePlan = async (id) => {
    saving.value = true;
    clearError();
    try {
      await animalService.deleteCarePlan(id);
      carePlans.value = carePlans.value.filter(p => p.id !== id);
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  // ---- Care Schedules & Tasks ----

  const fetchCareSchedules = async (params = {}) => {
    loading.value = true;
    clearError();
    try {
      const response = await animalService.getCareSchedules(params);
      careSchedules.value = response.data.data || [];
    } catch (err) {
      handleError(err);
    } finally {
      loading.value = false;
    }
  };

  const fetchScheduledTasks = async (params = {}) => {
    loading.value = true;
    clearError();
    try {
      const response = await animalService.getScheduledTasks(params);
      scheduledTasks.value = response.data.data || [];
    } catch (err) {
      handleError(err);
    } finally {
      loading.value = false;
    }
  };

  const fetchCareAlerts = async (params = {}) => {
    try {
      const response = await animalService.getCareAlertsSummary(params);
      careAlerts.value = response.data.data;
    } catch (err) {
      handleError(err);
    }
  };

  const completeScheduledTask = async (taskId, data = {}) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.completeScheduledTask(taskId, data);
      // Refresh scheduled tasks
      await fetchScheduledTasks();
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  const skipScheduledTask = async (taskId, data) => {
    saving.value = true;
    clearError();
    try {
      const response = await animalService.skipScheduledTask(taskId, data);
      // Refresh scheduled tasks
      await fetchScheduledTasks();
      return response.data.data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      saving.value = false;
    }
  };

  // ---- Initialize ----

  const initializeStore = async () => {
    await Promise.all([
      fetchAnimalTypes(),
      fetchBreeds(),
      fetchHousing()
    ]);
  };

  return {
    // State
    animalTypes,
    animalTypeCategories,
    breeds,
    housing,
    housingTypes,
    animals,
    currentAnimal,
    animalStatistics,
    groups,
    currentGroup,
    groupStatistics,
    deaths,
    deathStatistics,
    carePlans,
    currentCarePlan,
    careSchedules,
    scheduledTasks,
    careAlerts,
    loading,
    saving,
    error,
    pagination,

    // Getters
    activeAnimals,
    activeGroups,
    totalActiveAnimals,
    totalActiveGroupAnimals,
    breedsByType,
    activeHousing,

    // Actions
    clearError,
    fetchAnimalTypes,
    fetchAnimalTypeCategories,
    createAnimalType,
    updateAnimalType,
    deleteAnimalType,
    fetchBreeds,
    createBreed,
    updateBreed,
    deleteBreed,
    fetchHousing,
    fetchHousingTypes,
    createHousing,
    updateHousing,
    deleteHousing,
    fetchAnimals,
    fetchAnimalById,
    fetchAnimalStatistics,
    createAnimal,
    updateAnimal,
    recordAnimalSale,
    recordAnimalDeath,
    deleteAnimal,
    fetchGroups,
    fetchGroupById,
    fetchGroupStatistics,
    createGroup,
    updateGroup,
    recordGroupAddition,
    recordGroupRemoval,
    recordGroupDeaths,
    closeGroup,
    deleteGroup,
    fetchDeaths,
    fetchDeathStatistics,
    fetchCarePlans,
    fetchCarePlanById,
    createCarePlan,
    updateCarePlan,
    cloneCarePlan,
    deleteCarePlan,
    fetchCareSchedules,
    fetchScheduledTasks,
    fetchCareAlerts,
    completeScheduledTask,
    skipScheduledTask,
    initializeStore
  };
});
